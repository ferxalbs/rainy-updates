import process from "node:process";
import type { ParsedCliArgs } from "../core/options.js";
import { check } from "../core/check.js";
import { upgrade } from "../core/upgrade.js";
import { warmCache } from "../core/warm-cache.js";
import { runCi } from "../core/ci.js";
import { initCiWorkflow } from "../core/init-ci.js";
import { diffBaseline, saveBaseline } from "../core/baseline.js";
import type {
  CheckOptions,
  CheckResult,
  UpgradeOptions,
} from "../types/index.js";

export async function handleDirectCommand(parsed: ParsedCliArgs): Promise<boolean> {
  if (parsed.command === "init-ci") {
    const workflow = await initCiWorkflow(
      parsed.options.cwd,
      parsed.options.force,
      {
        mode: parsed.options.mode,
        schedule: parsed.options.schedule,
      },
    );
    process.stdout.write(
      workflow.created
        ? `Created CI workflow at ${workflow.path}\n`
        : `CI workflow already exists at ${workflow.path}. Use --force to overwrite.\n`,
    );
    return true;
  }

  if (parsed.command === "baseline") {
    if (parsed.options.action === "save") {
      const saved = await saveBaseline(parsed.options);
      process.stdout.write(
        `Saved baseline at ${saved.filePath} (${saved.entries} entries)\n`,
      );
      return true;
    }

    const diff = await diffBaseline(parsed.options);
    const changes = diff.added.length + diff.removed.length + diff.changed.length;

    if (changes === 0) {
      process.stdout.write(`No baseline drift detected (${diff.filePath}).\n`);
      return true;
    }

    process.stdout.write(`Baseline drift detected (${diff.filePath}).\n`);
    if (diff.added.length > 0) process.stdout.write(`Added: ${diff.added.length}\n`);
    if (diff.removed.length > 0) process.stdout.write(`Removed: ${diff.removed.length}\n`);
    if (diff.changed.length > 0) process.stdout.write(`Changed: ${diff.changed.length}\n`);
    process.exitCode = 1;
    return true;
  }

  if (parsed.command === "bisect") {
    const { runBisect } = await import("../commands/bisect/runner.js");
    const result = await runBisect(parsed.options);
    process.exitCode = result.breakingVersion ? 1 : 0;
    return true;
  }

  if (parsed.command === "audit") {
    const { runAudit } = await import("../commands/audit/runner.js");
    const result = await runAudit(parsed.options);
    process.exitCode = result.advisories.length > 0 ? 1 : 0;
    return true;
  }

  if (parsed.command === "health") {
    const { runHealth } = await import("../commands/health/runner.js");
    const result = await runHealth(parsed.options);
    process.exitCode = result.totalFlagged > 0 ? 1 : 0;
    return true;
  }

  if (parsed.command === "unused") {
    const { runUnused } = await import("../commands/unused/runner.js");
    const result = await runUnused(parsed.options);
    process.exitCode = result.totalUnused > 0 || result.totalMissing > 0 ? 1 : 0;
    return true;
  }

  if (parsed.command === "resolve") {
    const { runResolve } = await import("../commands/resolve/runner.js");
    const result = await runResolve(parsed.options);
    process.exitCode = result.errorConflicts > 0 ? 1 : 0;
    return true;
  }

  if (parsed.command === "licenses") {
    const { runLicenses } = await import("../commands/licenses/runner.js");
    const result = await runLicenses(parsed.options);
    process.exitCode = result.totalViolations > 0 ? 1 : 0;
    return true;
  }

  if (parsed.command === "snapshot") {
    const { runSnapshot } = await import("../commands/snapshot/runner.js");
    const result = await runSnapshot(parsed.options);
    process.exitCode = result.errors.length > 0 ? 1 : 0;
    return true;
  }

  if (parsed.command === "review") {
    const { runReview } = await import("../commands/review/runner.js");
    const result = await runReview(parsed.options);
    process.exitCode =
      result.summary.verdict === "blocked" ||
      result.summary.verdict === "actionable" ||
      result.summary.verdict === "review"
        ? 1
        : 0;
    return true;
  }

  if (parsed.command === "doctor") {
    const { runDoctor } = await import("../commands/doctor/runner.js");
    const result = await runDoctor(parsed.options);
    process.exitCode = result.verdict === "safe" ? 0 : 1;
    return true;
  }

  if (parsed.command === "dashboard") {
    const { runDashboard } = await import("../commands/dashboard/runner.js");
    const result = await runDashboard(parsed.options);
    process.exitCode = result.errors.length > 0 ? 1 : 0;
    return true;
  }

  if (parsed.command === "ga") {
    const { runGa } = await import("../commands/ga/runner.js");
    const result = await runGa(parsed.options);
    process.exitCode = result.ready ? 0 : 1;
    return true;
  }

  if (
    parsed.options.interactive &&
    (parsed.command === "check" ||
      parsed.command === "upgrade" ||
      parsed.command === "ci")
  ) {
    const { runDashboard } = await import("../commands/dashboard/runner.js");
    const result = await runDashboard({
      ...parsed.options,
      mode: parsed.command === "upgrade" ? "upgrade" : "review",
      focus: "all",
      applySelected: parsed.command === "upgrade",
    });
    process.exitCode = result.errors.length > 0 ? 1 : 0;
    return true;
  }

  return false;
}

export async function runPrimaryCommand(
  parsed:
    | { command: "check"; options: CheckOptions }
    | { command: "upgrade"; options: UpgradeOptions }
    | { command: "warm-cache"; options: CheckOptions }
    | { command: "ci"; options: CheckOptions },
): Promise<CheckResult> {
  if (parsed.command === "upgrade") {
    return upgrade(parsed.options);
  }

  if (parsed.command === "warm-cache") {
    return warmCache(parsed.options);
  }

  if (parsed.command === "ci") {
    return runCi(parsed.options);
  }

  if (parsed.options.fixPr) {
    const upgradeOptions: UpgradeOptions = {
      ...parsed.options,
      install: false,
      packageManager: "auto",
      sync: false,
    };
    return upgrade(upgradeOptions);
  }

  return check(parsed.options);
}
