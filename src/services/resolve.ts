import type { ResolveOptions, ResolveResult, ServiceContext } from "../types/index.js";
import { buildPeerGraph } from "../commands/resolve/graph/builder.js";
import { resolvePeerConflicts } from "../commands/resolve/graph/resolver.js";
import { check } from "../core/check.js";
import { emitServiceEvent } from "./context.js";

export async function runResolveService(
  options: ResolveOptions,
  context?: ServiceContext,
): Promise<ResolveResult> {
  const result: ResolveResult = {
    conflicts: [],
    errorConflicts: 0,
    warningConflicts: 0,
    errors: [],
    warnings: [],
  };

  let versionOverrides: Map<string, string> | undefined;
  if (options.afterUpdate) {
    versionOverrides = await fetchProposedVersions(options);
    if (versionOverrides.size === 0) {
      emitServiceEvent(context, {
        level: "info",
        message: "[resolve] No pending updates found; checking current state",
      });
    }
  }

  try {
    const graph = await buildPeerGraph(options, versionOverrides);
    result.conflicts = resolvePeerConflicts(graph);
    result.errorConflicts = result.conflicts.filter((c) => c.severity === "error").length;
    result.warningConflicts = result.conflicts.filter((c) => c.severity === "warning").length;
  } catch (error) {
    result.errors.push(`Failed to build peer graph: ${String(error)}`);
  }

  return result;
}

async function fetchProposedVersions(
  options: ResolveOptions,
): Promise<Map<string, string>> {
  const overrides = new Map<string, string>();
  try {
    const checkResult = await check({
      cwd: options.cwd,
      workspace: options.workspace,
      concurrency: options.concurrency,
      target: "latest",
      filter: undefined,
      reject: undefined,
      includeKinds: ["dependencies", "devDependencies", "optionalDependencies"],
      ci: false,
      format: "table",
      jsonFile: undefined,
      githubOutputFile: undefined,
      sarifFile: undefined,
      cacheTtlSeconds: options.cacheTtlSeconds,
      registryTimeoutMs: options.registryTimeoutMs,
      registryRetries: 2,
      offline: false,
      stream: false,
      policyFile: undefined,
      prReportFile: undefined,
      failOn: "none",
      maxUpdates: undefined,
      fixPr: false,
      fixBranch: "chore/rainy-updates",
      fixCommitMessage: undefined,
      fixDryRun: false,
      fixPrNoCheckout: false,
      fixPrBatchSize: undefined,
      noPrReport: false,
      logLevel: "info",
      groupBy: "none",
      groupMax: undefined,
      cooldownDays: undefined,
      prLimit: undefined,
      onlyChanged: false,
      affected: options.affected,
      staged: options.staged,
      baseRef: options.baseRef,
      headRef: options.headRef,
      sinceRef: options.sinceRef,
      ciProfile: "minimal",
      lockfileMode: "preserve",
      interactive: false,
      showImpact: false,
      showHomepage: false,
      decisionPlanFile: undefined,
      verify: "none",
      testCommand: undefined,
      verificationReportFile: undefined,
      ciGate: "check",
    });

    for (const update of checkResult.updates) {
      overrides.set(update.name, update.toVersionResolved);
    }
  } catch {
    // Fall back to current state.
  }
  return overrides;
}

export function renderResolveTable(
  result: ResolveResult,
  options: ResolveOptions,
): string {
  const { conflicts } = result;
  if (conflicts.length === 0) {
    return options.afterUpdate
      ? "✔ No peer conflicts detected after proposed updates are applied."
      : "✔ No peer conflicts detected in current dependency tree.";
  }

  const lines: string[] = [];
  const header = options.afterUpdate
    ? `\nPeer conflicts after proposed updates (${conflicts.length} found):\n`
    : `\nPeer conflicts in current dependency tree (${conflicts.length} found):\n`;
  lines.push(header);

  const errors = conflicts.filter((c) => c.severity === "error");
  const warnings = conflicts.filter((c) => c.severity === "warning");

  if (errors.length > 0) {
    lines.push(`  ✖ Errors (${errors.length}) — would cause ERESOLVE on install:\n`);
    for (const conflict of errors) {
      lines.push(
        `    \x1b[31m✖\x1b[0m ${conflict.requester}  requires  ${conflict.peer}@${conflict.requiredRange}  got  ${conflict.resolvedVersion}`,
      );
      lines.push(`      → ${conflict.suggestion}`);
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push(`  ⚠ Warnings (${warnings.length}) — soft peer incompatibilities:\n`);
    for (const conflict of warnings) {
      lines.push(
        `    \x1b[33m⚠\x1b[0m ${conflict.requester}  requires  ${conflict.peer}@${conflict.requiredRange}  got  ${conflict.resolvedVersion}`,
      );
      lines.push(`      → ${conflict.suggestion}`);
    }
  }

  return lines.join("\n");
}
