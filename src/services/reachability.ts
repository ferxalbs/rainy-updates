import path from "node:path";
import { discoverPackageDirs } from "../workspace/discover.js";
import { runAuditService } from "./audit.js";
import { findMatchingException } from "./exceptions.js";
import type {
  AuditOptions,
  CveAdvisory,
  ReachabilityFinding,
  ReachabilityOptions,
  ReachabilityResult,
  ReviewItem,
} from "../types/index.js";

interface ImportIndex {
  importedPackages: Set<string>;
  packageEntrypoints: Map<string, Set<string>>;
}

export async function runReachabilityService(
  options: ReachabilityOptions,
): Promise<ReachabilityResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const auditOptions: AuditOptions = {
    cwd: options.cwd,
    workspace: options.workspace,
    affected: false,
    staged: false,
    baseRef: undefined,
    headRef: undefined,
    sinceRef: undefined,
    severity: options.severity,
    fix: false,
    dryRun: false,
    commit: false,
    packageManager: "auto",
    reportFormat: "json",
    sourceMode: "auto",
    jsonFile: undefined,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
    silent: true,
  };

  const [auditResult, importIndex] = await Promise.all([
    runAuditService(auditOptions),
    scanWorkspaceImports(options.cwd, options.workspace),
  ]);

  errors.push(...auditResult.errors);
  warnings.push(...auditResult.warnings);

  const findings: ReachabilityFinding[] = [];

  for (const advisory of auditResult.advisories) {
    const finding = await advisoryToReachability(
      advisory,
      importIndex,
      options.cwd,
      options.exceptionsFile,
    );
    findings.push(finding);
  }

  return {
    findings,
    summary: {
      reachable: findings.filter((item) => item.status === "reachable").length,
      notReachable: findings.filter((item) => item.status === "not-reachable").length,
      unknown: findings.filter((item) => item.status === "unknown").length,
      suppressedByExceptions: findings.filter((item) => item.suppressed).length,
    },
    errors,
    warnings,
  };
}

export async function applyReachabilitySignalsToReviewItems(
  items: ReviewItem[],
  cwd: string,
  workspace: boolean,
): Promise<ReviewItem[]> {
  if (items.length === 0) return items;

  const index = await scanWorkspaceImports(cwd, workspace);

  const updated: ReviewItem[] = [];
  for (const item of items) {
    if ((item.advisories.length ?? 0) === 0) {
      updated.push(item);
      continue;
    }

    const statuses = await Promise.all(
      item.advisories.map(async (advisory) => {
        return advisoryToReachability(advisory, index, cwd);
      }),
    );

    const strongest = statuses.find((entry) => entry.status === "reachable") ?? statuses[0];
    if (!strongest) {
      updated.push(item);
      continue;
    }

    const riskReasons = [...(item.update.riskReasons ?? [])];
    const evidence = strongest.evidence[0];
    if (evidence && !riskReasons.includes(evidence)) {
      riskReasons.push(evidence);
    }

    updated.push({
      ...item,
      update: {
        ...item.update,
        reachability: strongest.status,
        reachabilityConfidence: strongest.confidence,
        reachabilityEvidence: strongest.evidence,
        exceptionId: strongest.exceptionId,
        exceptionStatus: strongest.exceptionStatus,
        exceptionActive: strongest.suppressed,
        riskReasons,
      },
    });
  }

  return updated;
}

async function advisoryToReachability(
  advisory: CveAdvisory,
  importIndex: ImportIndex,
  cwd: string,
  exceptionsFile?: string,
): Promise<ReachabilityFinding> {
  const entrypoints = [...(importIndex.packageEntrypoints.get(advisory.packageName) ?? new Set())].sort();
  const isImported = importIndex.importedPackages.has(advisory.packageName);

  const status = isImported
    ? "reachable"
    : advisory.packageName.startsWith("@types/")
      ? "not-reachable"
      : "unknown";

  const confidence =
    status === "reachable"
      ? 0.9
      : status === "not-reachable"
        ? 0.8
        : 0.45;

  const evidence =
    status === "reachable"
      ? [`Imported in workspace (${entrypoints[0] ?? "unknown file"}).`]
      : status === "not-reachable"
        ? ["Type-only package; runtime exploitability is unlikely."]
        : ["No direct import detected; treat as transitive/unknown reachability."];

  const exception = await findMatchingException(
    cwd,
    advisory.packageName,
    advisory.cveId,
    exceptionsFile,
  );

  return {
    packageName: advisory.packageName,
    cveId: advisory.cveId,
    severity: advisory.severity,
    status,
    confidence,
    entrypoints,
    evidence,
    exceptionId: exception?.id,
    exceptionStatus: exception?.status,
    suppressed: Boolean(exception),
  };
}

async function scanWorkspaceImports(cwd: string, workspace: boolean): Promise<ImportIndex> {
  const packageDirs = await discoverPackageDirs(cwd, workspace, {
    includeDependents: false,
  });

  const importedPackages = new Set<string>();
  const packageEntrypoints = new Map<string, Set<string>>();
  const scanner = await loadScanDirectory();

  if (!scanner) {
    return {
      importedPackages,
      packageEntrypoints,
    };
  }

  for (const packageDir of packageDirs) {
    const imports = await scanner(packageDir);
    for (const packageName of imports) {
      importedPackages.add(packageName);
      const set = packageEntrypoints.get(packageName) ?? new Set<string>();
      set.add(path.relative(cwd, packageDir));
      packageEntrypoints.set(packageName, set);
    }
  }

  return {
    importedPackages,
    packageEntrypoints,
  };
}

async function loadScanDirectory(): Promise<
  ((dir: string) => Promise<Set<string>>) | null
> {
  try {
    const mod = await import("../commands/unused/scanner.js");
    return mod.scanDirectory;
  } catch {
    return null;
  }
}
