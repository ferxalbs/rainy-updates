import process from "node:process";
import type { ResolveOptions, ResolveResult } from "../../types/index.js";
import { buildPeerGraph } from "./graph/builder.js";
import { resolvePeerConflicts } from "./graph/resolver.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";

/**
 * Entry point for `rup resolve`. Lazy-loaded by cli.ts.
 *
 * Modes:
 *   default          — check current peer-dep state for conflicts
 *   --after-update   — re-check after applying pending `rup check` updates
 *                      in-memory (reads proposed versions from check runner)
 *
 * The pure-TS peer graph is assembled entirely from registry data; no subprocess
 * is spawned. When the cache is warm this completes in < 1 s for typical projects.
 */
export async function runResolve(
  options: ResolveOptions,
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
    if (versionOverrides.size === 0 && !options.silent) {
      process.stderr.write(
        "[resolve] No pending updates found — checking current state.\n",
      );
    }
  }

  let graph;
  try {
    graph = await buildPeerGraph(options, versionOverrides);
  } catch (err) {
    result.errors.push(`Failed to build peer graph: ${String(err)}`);
    return result;
  }

  const conflicts = resolvePeerConflicts(graph);
  result.conflicts = conflicts;
  result.errorConflicts = conflicts.filter(
    (c) => c.severity === "error",
  ).length;
  result.warningConflicts = conflicts.filter(
    (c) => c.severity === "warning",
  ).length;

  if (!options.silent) {
    process.stdout.write(renderConflictsTable(result, options) + "\n");
  }

  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
    if (!options.silent) {
      process.stderr.write(
        `[resolve] JSON report written to ${options.jsonFile}\n`,
      );
    }
  }

  return result;
}

/**
 * In --after-update mode, runs `rup check` logic in read-only mode to get
 * the proposed new versions, returning them as a version override map.
 */
async function fetchProposedVersions(
  options: ResolveOptions,
): Promise<Map<string, string>> {
  const overrides = new Map<string, string>();
  try {
    const { check } = await import("../../core/check.js");
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

    for (const update of checkResult.updates ?? []) {
      overrides.set(update.name, update.toVersionResolved);
    }
  } catch {
    // If check fails, fall back to current state (no overrides)
  }
  return overrides;
}

function renderConflictsTable(
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
    lines.push(
      `  ✖ Errors (${errors.length}) — would cause ERESOLVE on install:\n`,
    );
    for (const c of errors) {
      lines.push(
        `    \x1b[31m✖\x1b[0m ${c.requester}  requires  ${c.peer}@${c.requiredRange}  got  ${c.resolvedVersion}`,
      );
      lines.push(`      → ${c.suggestion}`);
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push(
      `  ⚠ Warnings (${warnings.length}) — soft peer incompatibilities:\n`,
    );
    for (const c of warnings) {
      lines.push(
        `    \x1b[33m⚠\x1b[0m ${c.requester}  requires  ${c.peer}@${c.requiredRange}  got  ${c.resolvedVersion}`,
      );
      lines.push(`      → ${c.suggestion}`);
    }
  }

  return lines.join("\n");
}
