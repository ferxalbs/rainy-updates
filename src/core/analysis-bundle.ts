import { fetchChangelog } from "../commands/changelog/fetcher.js";
import { applyImpactScores } from "./impact.js";
import { applyRiskAssessments } from "../risk/index.js";
import type {
  AnalysisBundle,
  AuditOptions,
  AuditResult,
  CheckOptions,
  DoctorOptions,
  HealthOptions,
  LicenseOptions,
  PackageUpdate,
  ResolveOptions,
  ResolveResult,
  ReviewItem,
  ReviewOptions,
  UnusedOptions,
  UnusedResult,
  ReleaseNotesSummary,
} from "../types/index.js";
import { check } from "./check.js";

export async function buildAnalysisBundle(
  options: ReviewOptions | DoctorOptions | CheckOptions,
  config: { includeChangelog?: boolean } = {},
): Promise<AnalysisBundle> {
  const baseCheckOptions: CheckOptions = {
    ...options,
    interactive: false,
    showImpact: true,
    showHomepage: true,
  };
  const checkResult = await check(baseCheckOptions);

  const [auditResult, resolveResult, healthResult, licenseResult, unusedResult] =
    await runSilenced(() =>
      Promise.all([
        import("../commands/audit/runner.js").then((mod) =>
          mod.runAudit(toAuditOptions(options)),
        ),
        import("../commands/resolve/runner.js").then((mod) =>
          mod.runResolve(toResolveOptions(options)),
        ),
        import("../commands/health/runner.js").then((mod) =>
          mod.runHealth(toHealthOptions(options)),
        ),
        import("../commands/licenses/runner.js").then((mod) =>
          mod.runLicenses(toLicenseOptions(options)),
        ),
        import("../commands/unused/runner.js").then((mod) =>
          mod.runUnused(toUnusedOptions(options)),
        ),
      ]),
    );

  const items = await buildReviewItems(
    checkResult.updates,
    auditResult,
    resolveResult,
    healthResult,
    licenseResult,
    unusedResult,
    config,
  );

  return {
    check: checkResult,
    audit: auditResult,
    resolve: resolveResult,
    health: healthResult,
    licenses: licenseResult,
    unused: unusedResult,
    items,
    degradedSources: auditResult.sourceHealth
      .filter((source) => source.status !== "ok")
      .map((source) => source.source),
  };
}

async function buildReviewItems(
  updates: PackageUpdate[],
  auditResult: AuditResult,
  resolveResult: ResolveResult,
  healthResult: AnalysisBundle["health"],
  licenseResult: AnalysisBundle["licenses"],
  unusedResult: UnusedResult,
  config: { includeChangelog?: boolean },
): Promise<ReviewItem[]> {
  const advisoryPackages = new Set(auditResult.packages.map((pkg) => pkg.packageName));
  const impactedUpdates = applyImpactScores(updates, {
    advisoryPackages,
    workspaceDependentCount: (name) => updates.filter((item) => item.name === name).length,
  });
  const healthByName = new Map(healthResult.metrics.map((metric) => [metric.name, metric]));
  const advisoriesByName = new Map<string, AuditResult["advisories"]>();
  const conflictsByName = new Map<string, ResolveResult["conflicts"]>();
  const licenseByName = new Map(licenseResult.packages.map((pkg) => [pkg.name, pkg]));
  const licenseViolationNames = new Set(licenseResult.violations.map((pkg) => pkg.name));
  const unusedByName = new Map<string, UnusedResult["unused"]>();

  for (const advisory of auditResult.advisories) {
    const list = advisoriesByName.get(advisory.packageName) ?? [];
    list.push(advisory);
    advisoriesByName.set(advisory.packageName, list);
  }
  for (const conflict of resolveResult.conflicts) {
    const list = conflictsByName.get(conflict.requester) ?? [];
    list.push(conflict);
    conflictsByName.set(conflict.requester, list);
    const peerList = conflictsByName.get(conflict.peer) ?? [];
    peerList.push(conflict);
    conflictsByName.set(conflict.peer, peerList);
  }
  for (const issue of [...unusedResult.unused, ...unusedResult.missing]) {
    const list = unusedByName.get(issue.name) ?? [];
    list.push(issue);
    unusedByName.set(issue.name, list);
  }

  const enrichedUpdates = await maybeAttachReleaseNotes(
    impactedUpdates,
    Boolean(config.includeChangelog),
  );

  return applyRiskAssessments(
    enrichedUpdates.map((update) =>
      enrichUpdate(
        update,
        advisoriesByName,
        conflictsByName,
        healthByName,
        licenseByName,
        licenseViolationNames,
        unusedByName,
      ),
    ),
    {
      knownPackageNames: new Set(updates.map((item) => item.name)),
    },
  ).map((item) => ({
    ...item,
    update: {
      ...item.update,
      policyAction: derivePolicyAction(item),
      decisionState: deriveDecisionState(item),
      selectedByDefault: deriveDecisionState(item) !== "blocked",
      blockedReason:
        deriveDecisionState(item) === "blocked"
          ? item.update.recommendedAction
          : undefined,
      monitorReason:
        item.update.healthStatus === "stale" ? "Package health should be monitored." : undefined,
    },
  }));
}

function enrichUpdate(
  update: PackageUpdate,
  advisoriesByName: Map<string, AuditResult["advisories"]>,
  conflictsByName: Map<string, ResolveResult["conflicts"]>,
  healthByName: Map<string, AnalysisBundle["health"]["metrics"][number]>,
  licenseByName: Map<string, AnalysisBundle["licenses"]["packages"][number]>,
  licenseViolationNames: Set<string>,
  unusedByName: Map<string, UnusedResult["unused"]>,
): ReviewItem {
  const advisories = advisoriesByName.get(update.name) ?? [];
  const peerConflicts = conflictsByName.get(update.name) ?? [];
  const health = healthByName.get(update.name);
  const license = licenseByName.get(update.name);
  const unusedIssues = unusedByName.get(update.name) ?? [];
  return {
    update: {
      ...update,
      advisoryCount: advisories.length,
      peerConflictSeverity: peerConflicts.some((item) => item.severity === "error")
        ? "error"
        : peerConflicts.length > 0
          ? "warning"
          : "none",
      licenseStatus: licenseViolationNames.has(update.name)
        ? "denied"
        : license
          ? "allowed"
          : "review",
      healthStatus: health?.flags[0] ?? "healthy",
    },
    advisories,
    health,
    peerConflicts,
    license,
    unusedIssues,
    selected: true,
  };
}

function derivePolicyAction(item: ReviewItem): PackageUpdate["policyAction"] {
  if (item.update.peerConflictSeverity === "error" || item.update.licenseStatus === "denied") {
    return "block";
  }
  if ((item.update.advisoryCount ?? 0) > 0 || item.update.riskLevel === "critical") {
    return "review";
  }
  if (item.update.healthStatus === "stale" || item.update.healthStatus === "archived") {
    return "monitor";
  }
  return "allow";
}

function deriveDecisionState(item: ReviewItem): PackageUpdate["decisionState"] {
  if (item.update.peerConflictSeverity === "error" || item.update.licenseStatus === "denied") {
    return "blocked";
  }
  if ((item.update.advisoryCount ?? 0) > 0 || item.update.riskLevel === "critical") {
    return "actionable";
  }
  if (item.update.riskLevel === "high" || item.update.diffType === "major") {
    return "review";
  }
  return "safe";
}

async function maybeAttachReleaseNotes(
  updates: PackageUpdate[],
  includeChangelog: boolean,
): Promise<PackageUpdate[]> {
  if (!includeChangelog || updates.length === 0) {
    return updates;
  }
  const enriched = await Promise.all(
    updates.map(async (update) => ({
      ...update,
      releaseNotesSummary: summarizeChangelog(
        await fetchChangelog(update.name, update.repository),
      ),
    })),
  );
  return enriched;
}

function summarizeChangelog(content: string | null): ReleaseNotesSummary | undefined {
  if (!content) return undefined;
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => line.startsWith("#"))?.replace(/^#+\s*/, "") ?? "Release notes";
  const excerpt = lines.find((line) => !line.startsWith("#")) ?? "No summary available.";
  return {
    source: content.includes("# Release") ? "github-release" : "changelog-file",
    title,
    excerpt: excerpt.slice(0, 240),
  };
}

async function runSilenced<T>(fn: () => Promise<T>): Promise<T> {
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (() => true) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    return await fn();
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
}

function toAuditOptions(options: CheckOptions): AuditOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    severity: undefined,
    fix: false,
    dryRun: true,
    commit: false,
    packageManager: "auto",
    reportFormat: "json",
    sourceMode: "auto",
    jsonFile: undefined,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
    silent: true,
  };
}

function toResolveOptions(options: CheckOptions): ResolveOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    afterUpdate: true,
    safe: false,
    jsonFile: undefined,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
    cacheTtlSeconds: options.cacheTtlSeconds,
    silent: true,
  };
}

function toHealthOptions(options: CheckOptions): HealthOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    staleDays: 365,
    includeDeprecated: true,
    includeAlternatives: false,
    reportFormat: "json",
    jsonFile: undefined,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
  };
}

function toLicenseOptions(options: CheckOptions): LicenseOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    allow: undefined,
    deny: undefined,
    sbomFile: undefined,
    jsonFile: undefined,
    diffMode: false,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
    cacheTtlSeconds: options.cacheTtlSeconds,
  };
}

function toUnusedOptions(options: CheckOptions): UnusedOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    srcDirs: ["src", "."],
    includeDevDependencies: true,
    fix: false,
    dryRun: true,
    jsonFile: undefined,
    concurrency: options.concurrency,
  };
}
