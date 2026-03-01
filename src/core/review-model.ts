import path from "node:path";
import process from "node:process";
import { check } from "./check.js";
import { createSummary, finalizeSummary } from "./summary.js";
import type {
  AuditOptions,
  AuditResult,
  CheckOptions,
  DoctorOptions,
  DoctorResult,
  HealthOptions,
  HealthResult,
  LicenseOptions,
  LicenseResult,
  PackageUpdate,
  ResolveOptions,
  ResolveResult,
  ReviewItem,
  ReviewOptions,
  ReviewResult,
  RiskLevel,
  Summary,
  UnusedOptions,
  UnusedResult,
  Verdict,
} from "../types/index.js";
import { applyImpactScores } from "./impact.js";

export async function buildReviewResult(
  options: ReviewOptions | DoctorOptions | CheckOptions,
): Promise<ReviewResult> {
  const baseCheckOptions: CheckOptions = {
    ...options,
    interactive: false,
    showImpact: true,
    showHomepage: true,
  };
  const checkResult = await check(baseCheckOptions);

  const [auditResult, resolveResult, healthResult, licenseResult, unusedResult] =
    await Promise.all([
      runSilenced(() => import("../commands/audit/runner.js").then((mod) => mod.runAudit(toAuditOptions(options)))),
      runSilenced(() => import("../commands/resolve/runner.js").then((mod) => mod.runResolve(toResolveOptions(options)))),
      runSilenced(() => import("../commands/health/runner.js").then((mod) => mod.runHealth(toHealthOptions(options)))),
      runSilenced(() => import("../commands/licenses/runner.js").then((mod) => mod.runLicenses(toLicenseOptions(options)))),
      runSilenced(() => import("../commands/unused/runner.js").then((mod) => mod.runUnused(toUnusedOptions(options)))),
    ]);

  const advisoryPackages = new Set(auditResult.packages.map((pkg) => pkg.packageName));
  const impactedUpdates = applyImpactScores(checkResult.updates, {
    advisoryPackages,
    workspaceDependentCount: (name) =>
      checkResult.updates.filter((item) => item.name === name).length,
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

  const items = impactedUpdates
    .map((update) =>
      enrichUpdate(
        update,
        advisoriesByName,
        conflictsByName,
        healthByName,
        licenseByName,
        licenseViolationNames,
        unusedByName,
      ),
    )
    .filter((item) => matchesReviewFilters(item, options));

  const summary = createReviewSummary(
    checkResult.summary,
    items,
    [
      ...checkResult.errors,
      ...auditResult.errors,
      ...resolveResult.errors,
      ...healthResult.errors,
      ...licenseResult.errors,
      ...unusedResult.errors,
    ],
    [
      ...checkResult.warnings,
      ...auditResult.warnings,
      ...resolveResult.warnings,
      ...healthResult.warnings,
      ...licenseResult.warnings,
      ...unusedResult.warnings,
    ],
    options.interactive === true,
  );

  return {
    projectPath: checkResult.projectPath,
    target: checkResult.target,
    summary,
    items,
    updates: items.map((item) => item.update),
    errors: [...checkResult.errors, ...auditResult.errors, ...resolveResult.errors, ...healthResult.errors, ...licenseResult.errors, ...unusedResult.errors],
    warnings: [...checkResult.warnings, ...auditResult.warnings, ...resolveResult.warnings, ...healthResult.warnings, ...licenseResult.warnings, ...unusedResult.warnings],
  };
}

export function createDoctorResult(review: ReviewResult): DoctorResult {
  const verdict = review.summary.verdict ?? deriveVerdict(review.items);
  const primaryFindings = buildPrimaryFindings(review);
  return {
    verdict,
    summary: review.summary,
    review,
    primaryFindings,
    recommendedCommand: recommendCommand(review, verdict),
  };
}

export function renderReviewResult(review: ReviewResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${review.projectPath}`);
  lines.push(`Target: ${review.target}`);
  lines.push(`Verdict: ${review.summary.verdict ?? "safe"}`);
  lines.push("");
  if (review.items.length === 0) {
    lines.push("No reviewable updates found.");
  } else {
    lines.push("Updates:");
    for (const item of review.items) {
      const notes = [
        item.update.diffType,
        item.update.riskLevel ? `risk=${item.update.riskLevel}` : undefined,
        item.update.advisoryCount ? `security=${item.update.advisoryCount}` : undefined,
        item.update.peerConflictSeverity && item.update.peerConflictSeverity !== "none"
          ? `peer=${item.update.peerConflictSeverity}`
          : undefined,
        item.update.licenseStatus && item.update.licenseStatus !== "allowed"
          ? `license=${item.update.licenseStatus}`
          : undefined,
      ].filter(Boolean);
      lines.push(
        `- ${path.basename(item.update.packagePath)} :: ${item.update.name} ${item.update.fromRange} -> ${item.update.toRange} (${notes.join(", ")})`,
      );
      if (item.update.riskReasons && item.update.riskReasons.length > 0) {
        lines.push(`  reasons: ${item.update.riskReasons.join("; ")}`);
      }
      if (item.update.homepage) {
        lines.push(`  homepage: ${item.update.homepage}`);
      }
    }
  }
  if (review.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const error of review.errors) {
      lines.push(`- ${error}`);
    }
  }
  if (review.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of review.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push("");
  lines.push(
    `Summary: ${review.summary.updatesFound} updates, riskPackages=${review.summary.riskPackages ?? 0}, securityPackages=${review.summary.securityPackages ?? 0}, peerConflictPackages=${review.summary.peerConflictPackages ?? 0}`,
  );
  return lines.join("\n");
}

export function renderDoctorResult(result: DoctorResult, verdictOnly = false): string {
  const lines = [
    `State: ${result.verdict}`,
    `PrimaryRisk: ${result.primaryFindings[0] ?? "No blocking findings."}`,
    `NextAction: ${result.recommendedCommand}`,
  ];
  if (!verdictOnly) {
    lines.push(
      `Counts: updates=${result.summary.updatesFound}, security=${result.summary.securityPackages ?? 0}, risk=${result.summary.riskPackages ?? 0}, peer=${result.summary.peerConflictPackages ?? 0}, license=${result.summary.licenseViolationPackages ?? 0}`,
    );
  }
  return lines.join("\n");
}

function enrichUpdate(
  update: PackageUpdate,
  advisoriesByName: Map<string, AuditResult["advisories"]>,
  conflictsByName: Map<string, ResolveResult["conflicts"]>,
  healthByName: Map<string, HealthResult["metrics"][number]>,
  licenseByName: Map<string, LicenseResult["packages"][number]>,
  licenseViolationNames: Set<string>,
  unusedByName: Map<string, UnusedResult["unused"]>,
): ReviewItem {
  const advisories = advisoriesByName.get(update.name) ?? [];
  const peerConflicts = conflictsByName.get(update.name) ?? [];
  const health = healthByName.get(update.name);
  const license = licenseByName.get(update.name);
  const unusedIssues = unusedByName.get(update.name) ?? [];
  const riskReasons = [
    advisories.length > 0 ? `${advisories.length} advisory finding(s)` : undefined,
    peerConflicts.some((item) => item.severity === "error") ? "peer conflict requires review" : undefined,
    health?.flags.includes("deprecated") ? "package is deprecated" : undefined,
    health?.flags.includes("stale") ? "package is stale" : undefined,
    licenseViolationNames.has(update.name) ? "license policy violation" : undefined,
    unusedIssues.length > 0 ? `${unusedIssues.length} unused/missing dependency signal(s)` : undefined,
    update.diffType === "major" ? "major version jump" : undefined,
  ].filter((value): value is string => Boolean(value));

  const riskLevel = deriveRiskLevel(update, advisories.length, peerConflicts.length, licenseViolationNames.has(update.name), health?.flags ?? []);

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
      riskLevel,
      riskReasons,
    },
    advisories,
    health,
    peerConflicts,
    license,
    unusedIssues,
    selected: true,
  };
}

function matchesReviewFilters(
  item: ReviewItem,
  options: ReviewOptions | DoctorOptions | CheckOptions,
): boolean {
  if ("securityOnly" in options && options.securityOnly && item.advisories.length === 0) {
    return false;
  }
  if ("risk" in options && options.risk && !riskMatches(item.update.riskLevel, options.risk)) {
    return false;
  }
  if ("diff" in options && options.diff && item.update.diffType !== options.diff) {
    return false;
  }
  return true;
}

function riskMatches(current: RiskLevel | undefined, threshold: RiskLevel): boolean {
  const order: Record<RiskLevel, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return order[current ?? "low"] >= order[threshold];
}

function createReviewSummary(
  base: Summary,
  items: ReviewItem[],
  errors: string[],
  warnings: string[],
  interactiveSession: boolean,
): Summary {
  const summary = finalizeSummary(
    createSummary({
      scannedPackages: base.scannedPackages,
      totalDependencies: base.totalDependencies,
      checkedDependencies: base.checkedDependencies,
      updatesFound: items.length,
      upgraded: base.upgraded,
      skipped: base.skipped,
      warmedPackages: base.warmedPackages,
      errors,
      warnings,
      durations: {
        totalMs: base.durationMs.total,
        discoveryMs: base.durationMs.discovery,
        registryMs: base.durationMs.registry,
        cacheMs: base.durationMs.cache,
      },
      groupedUpdates: base.groupedUpdates,
      cooldownSkipped: base.cooldownSkipped,
      ciProfile: base.ciProfile,
      prLimitHit: base.prLimitHit,
      policyOverridesApplied: base.policyOverridesApplied,
    }),
  );
  summary.durationMs.render = base.durationMs.render;
  summary.streamedEvents = base.streamedEvents;
  summary.fixPrApplied = base.fixPrApplied;
  summary.fixBranchName = base.fixBranchName;
  summary.fixCommitSha = base.fixCommitSha;
  summary.fixPrBranchesCreated = base.fixPrBranchesCreated;
  summary.interactiveSession = interactiveSession;
  summary.securityPackages = items.filter((item) => item.advisories.length > 0).length;
  summary.riskPackages = items.filter(
    (item) =>
      item.update.riskLevel === "critical" || item.update.riskLevel === "high",
  ).length;
  summary.peerConflictPackages = items.filter(
    (item) => item.update.peerConflictSeverity && item.update.peerConflictSeverity !== "none",
  ).length;
  summary.licenseViolationPackages = items.filter(
    (item) => item.update.licenseStatus === "denied",
  ).length;
  summary.verdict = deriveVerdict(items);
  return summary;
}

function deriveVerdict(items: ReviewItem[]): Verdict {
  if (
    items.some(
      (item) =>
        item.update.peerConflictSeverity === "error" ||
        item.update.licenseStatus === "denied",
    )
  ) {
    return "blocked";
  }
  if (items.some((item) => item.advisories.length > 0 || item.update.riskLevel === "critical")) {
    return "actionable";
  }
  if (items.some((item) => item.update.riskLevel === "high" || item.update.diffType === "major")) {
    return "review";
  }
  return "safe";
}

function deriveRiskLevel(
  update: PackageUpdate,
  advisories: number,
  conflicts: number,
  hasLicenseViolation: boolean,
  healthFlags: string[],
): RiskLevel {
  if (hasLicenseViolation || conflicts > 0 || advisories > 0) {
    return update.diffType === "major" || advisories > 0 ? "critical" : "high";
  }
  if (healthFlags.includes("deprecated") || update.diffType === "major") {
    return "high";
  }
  if (healthFlags.length > 0 || update.diffType === "minor") {
    return "medium";
  }
  return update.impactScore?.rank ?? "low";
}

function buildPrimaryFindings(review: ReviewResult): string[] {
  const findings: string[] = [];
  if ((review.summary.peerConflictPackages ?? 0) > 0) {
    findings.push(`${review.summary.peerConflictPackages} package(s) have peer conflicts.`);
  }
  if ((review.summary.licenseViolationPackages ?? 0) > 0) {
    findings.push(`${review.summary.licenseViolationPackages} package(s) violate license policy.`);
  }
  if ((review.summary.securityPackages ?? 0) > 0) {
    findings.push(`${review.summary.securityPackages} package(s) have security advisories.`);
  }
  if ((review.summary.riskPackages ?? 0) > 0) {
    findings.push(`${review.summary.riskPackages} package(s) are high risk.`);
  }
  if (findings.length === 0) {
    findings.push("No blocking findings; remaining updates are low-risk.");
  }
  return findings;
}

function recommendCommand(review: ReviewResult, verdict: Verdict): string {
  if (verdict === "blocked") return "rup resolve --after-update";
  if ((review.summary.securityPackages ?? 0) > 0) return "rup audit --fix";
  if (review.items.length > 0) return "rup review --interactive";
  return "rup check";
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
