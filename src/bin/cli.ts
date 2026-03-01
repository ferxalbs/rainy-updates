#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "../core/options.js";
import { check } from "../core/check.js";
import { upgrade } from "../core/upgrade.js";
import { warmCache } from "../core/warm-cache.js";
import { runCi } from "../core/ci.js";
import { initCiWorkflow } from "../core/init-ci.js";
import { diffBaseline, saveBaseline } from "../core/baseline.js";
import { applyFixPr } from "../core/fix-pr.js";
import { applyFixPrBatches } from "../core/fix-pr-batch.js";
import { renderResult } from "../output/format.js";
import { writeGitHubOutput } from "../output/github.js";
import { createSarifReport } from "../output/sarif.js";
import { renderPrReport } from "../output/pr-report.js";
import type {
  CheckOptions,
  CheckResult,
  FailReason,
  UpgradeOptions,
} from "../types/index.js";
import { writeFileAtomic } from "../utils/io.js";
import { resolveFailReason } from "../core/summary.js";
import { stableStringify } from "../utils/stable-json.js";
import type {
  DoctorOptions,
  ReviewOptions,
  DashboardOptions,
} from "../types/index.js";

async function main(): Promise<void> {
  try {
    const argv = process.argv.slice(2);
    if (argv.includes("--version") || argv.includes("-v")) {
      process.stdout.write((await readPackageVersion()) + "\n");
      return;
    }

    if (argv.includes("--help") || argv.includes("-h")) {
      process.stdout.write(renderHelp(argv[0]) + "\n");
      return;
    }

    const parsed = await parseCliArgs(argv);

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
      return;
    }

    if (parsed.command === "baseline") {
      if (parsed.options.action === "save") {
        const saved = await saveBaseline(parsed.options);
        process.stdout.write(
          `Saved baseline at ${saved.filePath} (${saved.entries} entries)\n`,
        );
        return;
      }

      const diff = await diffBaseline(parsed.options);
      const changes =
        diff.added.length + diff.removed.length + diff.changed.length;

      if (changes === 0) {
        process.stdout.write(
          `No baseline drift detected (${diff.filePath}).\n`,
        );
        return;
      }

      process.stdout.write(`Baseline drift detected (${diff.filePath}).\n`);
      if (diff.added.length > 0) {
        process.stdout.write(`Added: ${diff.added.length}\n`);
      }
      if (diff.removed.length > 0) {
        process.stdout.write(`Removed: ${diff.removed.length}\n`);
      }
      if (diff.changed.length > 0) {
        process.stdout.write(`Changed: ${diff.changed.length}\n`);
      }

      process.exitCode = 1;
      return;
    }

    // ─── v0.5.1 commands: lazy-loaded, isolated from check pipeline ──────────
    if (parsed.command === "bisect") {
      const { runBisect } = await import("../commands/bisect/runner.js");
      const result = await runBisect(parsed.options);
      process.exitCode = result.breakingVersion ? 1 : 0;
      return;
    }

    if (parsed.command === "audit") {
      const { runAudit } = await import("../commands/audit/runner.js");
      const result = await runAudit(parsed.options);
      process.exitCode = result.advisories.length > 0 ? 1 : 0;
      return;
    }

    if (parsed.command === "health") {
      const { runHealth } = await import("../commands/health/runner.js");
      const result = await runHealth(parsed.options);
      process.exitCode = result.totalFlagged > 0 ? 1 : 0;
      return;
    }

    // ─── v0.5.4 commands ─────────────────────────────────────────────────────
    if (parsed.command === "unused") {
      const { runUnused } = await import("../commands/unused/runner.js");
      const result = await runUnused(parsed.options);
      process.exitCode =
        result.totalUnused > 0 || result.totalMissing > 0 ? 1 : 0;
      return;
    }

    if (parsed.command === "resolve") {
      const { runResolve } = await import("../commands/resolve/runner.js");
      const result = await runResolve(parsed.options);
      process.exitCode = result.errorConflicts > 0 ? 1 : 0;
      return;
    }

    if (parsed.command === "licenses") {
      const { runLicenses } = await import("../commands/licenses/runner.js");
      const result = await runLicenses(parsed.options);
      process.exitCode = result.totalViolations > 0 ? 1 : 0;
      return;
    }

    if (parsed.command === "snapshot") {
      const { runSnapshot } = await import("../commands/snapshot/runner.js");
      const result = await runSnapshot(parsed.options);
      process.exitCode = result.errors.length > 0 ? 1 : 0;
      return;
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
      return;
    }

    if (parsed.command === "doctor") {
      const { runDoctor } = await import("../commands/doctor/runner.js");
      const result = await runDoctor(parsed.options);
      process.exitCode = result.verdict === "safe" ? 0 : 1;
      return;
    }

    if (parsed.command === "dashboard") {
      const { runDashboard } = await import("../commands/dashboard/runner.js");
      const result = await runDashboard(parsed.options);
      process.exitCode = result.errors.length > 0 ? 1 : 0;
      return;
    }

    if (
      parsed.options.interactive &&
      (parsed.command === "check" ||
        parsed.command === "upgrade" ||
        parsed.command === "ci")
    ) {
      const { runReview } = await import("../commands/review/runner.js");
      const result = await runReview({
        ...parsed.options,
        securityOnly: false,
        risk: undefined,
        diff: undefined,
        applySelected: parsed.command === "upgrade",
      });
      process.exitCode =
        result.summary.verdict === "safe" && result.updates.length === 0
          ? 0
          : 1;
      return;
    }

    const result = await runCommand(parsed);

    if (
      parsed.options.fixPr &&
      (parsed.command === "check" ||
        parsed.command === "upgrade" ||
        parsed.command === "ci")
    ) {
      result.summary.fixPrApplied = false;
      result.summary.fixBranchName =
        parsed.options.fixBranch ?? "chore/rainy-updates";
      result.summary.fixCommitSha = "";
      result.summary.fixPrBranchesCreated = 0;

      if (parsed.command === "ci") {
        const batched = await applyFixPrBatches(parsed.options, result);
        result.summary.fixPrApplied = batched.applied;
        result.summary.fixBranchName =
          batched.branches[0] ??
          parsed.options.fixBranch ??
          "chore/rainy-updates";
        result.summary.fixCommitSha = batched.commits[0] ?? "";
        result.summary.fixPrBranchesCreated = batched.branches.length;
        if (batched.branches.length > 1) {
          result.warnings.push(
            `Created ${batched.branches.length} fix-pr batch branches.`,
          );
        }
      } else {
        const fixResult = await applyFixPr(parsed.options, result, []);
        result.summary.fixPrApplied = fixResult.applied;
        result.summary.fixBranchName = fixResult.branchName ?? "";
        result.summary.fixCommitSha = fixResult.commitSha ?? "";
        result.summary.fixPrBranchesCreated = fixResult.applied ? 1 : 0;
      }
    }

    if (parsed.options.prReportFile) {
      const markdown = renderPrReport(result);
      await writeFileAtomic(parsed.options.prReportFile, markdown + "\n");
    }

    result.summary.failReason = resolveFailReason(
      result.updates,
      result.errors,
      parsed.options.failOn,
      parsed.options.maxUpdates,
      parsed.options.ci,
    );

    const renderStartedAt = Date.now();
    let rendered = renderResult(result, parsed.options.format, {
      showImpact: parsed.options.showImpact,
      showHomepage: parsed.options.showHomepage,
    });
    result.summary.durationMs.render = Math.max(
      0,
      Date.now() - renderStartedAt,
    );
    if (
      parsed.options.format === "json" ||
      parsed.options.format === "metrics"
    ) {
      rendered = renderResult(result, parsed.options.format, {
        showImpact: parsed.options.showImpact,
        showHomepage: parsed.options.showHomepage,
      });
    }
    if (
      parsed.options.onlyChanged &&
      result.updates.length === 0 &&
      result.errors.length === 0 &&
      result.warnings.length === 0 &&
      (parsed.options.format === "table" ||
        parsed.options.format === "minimal" ||
        parsed.options.format === "github")
    ) {
      rendered = "";
    }

    if (parsed.options.jsonFile) {
      await writeFileAtomic(
        parsed.options.jsonFile,
        stableStringify(result, 2) + "\n",
      );
    }

    if (parsed.options.githubOutputFile) {
      await writeGitHubOutput(parsed.options.githubOutputFile, result);
    }

    if (parsed.options.sarifFile) {
      const sarif = createSarifReport(result);
      await writeFileAtomic(
        parsed.options.sarifFile,
        stableStringify(sarif, 2) + "\n",
      );
    }

    process.stdout.write(rendered + "\n");

    process.exitCode = resolveExitCode(result, result.summary.failReason);
  } catch (error) {
    process.stderr.write(`rainy-updates (rup): ${String(error)}\n`);
    process.exitCode = 2;
  }
}

void main();

function renderHelp(command?: string): string {
  const isCommand = command && !command.startsWith("-");
  if (isCommand && command === "check") {
    return `rainy-updates check [options]

Detect candidate dependency updates. This is the first step in the flow:
  check detects
  doctor summarizes
  review decides
  upgrade applies

Options:
  --workspace
  --target patch|minor|major|latest
  --filter <pattern>
  --reject <pattern>
  --dep-kinds deps,dev,optional,peer
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --cache-ttl <seconds>
  --stream
  --policy-file <path>
  --offline
  --fix-pr
  --fix-branch <name>
  --fix-commit-message <text>
  --fix-dry-run
  --fix-pr-no-checkout
  --fix-pr-batch-size <n>
  --no-pr-report
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>
  --fail-on none|patch|minor|major|any
  --max-updates <n>
  --group-by none|name|scope|kind|risk
  --group-max <n>
  --cooldown-days <n>
  --pr-limit <n>
  --only-changed
  --interactive
  --show-impact
  --show-homepage
  --lockfile-mode preserve|update|error
  --log-level error|warn|info|debug
  --ci`;
  }

  if (isCommand && command === "warm-cache") {
    return `rainy-updates warm-cache [options]

Pre-warm local metadata cache for faster CI checks.

Options:
  --workspace
  --target patch|minor|major|latest
  --filter <pattern>
  --reject <pattern>
  --dep-kinds deps,dev,optional,peer
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --cache-ttl <seconds>
  --offline
  --stream
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>`;
  }

  if (isCommand && command === "upgrade") {
    return `rainy-updates upgrade [options]

Apply an approved change set to package.json manifests.

Options:
  --workspace
  --sync
  --install
  --pm auto|npm|pnpm
  --target patch|minor|major|latest
  --policy-file <path>
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --fix-pr
  --fix-branch <name>
  --fix-commit-message <text>
  --fix-dry-run
  --fix-pr-no-checkout
  --fix-pr-batch-size <n>
  --interactive
  --lockfile-mode preserve|update|error
  --no-pr-report
  --json-file <path>
  --pr-report-file <path>`;
  }

  if (isCommand && command === "ci") {
    return `rainy-updates ci [options]

Run CI-oriented automation around the same lifecycle:
  check detects
  doctor summarizes
  review decides
  upgrade applies

Options:
  --workspace
  --mode minimal|strict|enterprise
  --group-by none|name|scope|kind|risk
  --group-max <n>
  --cooldown-days <n>
  --pr-limit <n>
  --only-changed
  --offline
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --stream
  --fix-pr
  --fix-branch <name>
  --fix-commit-message <text>
  --fix-dry-run
  --fix-pr-no-checkout
  --fix-pr-batch-size <n>
  --no-pr-report
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>
  --fail-on none|patch|minor|major|any
  --max-updates <n>
  --lockfile-mode preserve|update|error
  --log-level error|warn|info|debug
  --ci`;
  }

  if (isCommand && command === "init-ci") {
    return `rainy-updates init-ci [options]

Create a GitHub Actions workflow template at:
  .github/workflows/rainy-updates.yml

Options:
  --force
  --mode minimal|strict|enterprise
  --schedule weekly|daily|off`;
  }

  if (isCommand && command === "baseline") {
    return `rainy-updates baseline [options]

Save or compare dependency baseline snapshots.

Options:
  --save
  --check
  --file <path>
  --workspace
  --dep-kinds deps,dev,optional,peer
  --ci`;
  }

  if (isCommand && command === "audit") {
    return `rainy-updates audit [options]

Scan dependencies for CVEs using OSV.dev and GitHub Advisory Database.

Options:
  --workspace
  --severity critical|high|medium|low
  --summary
  --report table|summary|json
  --source auto|osv|github|all
  --fix
  --dry-run
  --commit
  --pm auto|npm|pnpm|bun|yarn
  --json-file <path>
  --concurrency <n>
  --registry-timeout-ms <n>`;
  }

  if (isCommand && command === "review") {
    return `rainy-updates review [options]

Review is the decision center of Rainy Updates.
Use it to inspect risk, security, peer, license, and policy context before applying changes.

Options:
  --workspace
  --interactive
  --security-only
  --risk critical|high|medium|low
  --diff patch|minor|major|latest
  --apply-selected
  --policy-file <path>
  --json-file <path>
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>`;
  }

  if (isCommand && command === "doctor") {
    return `rainy-updates doctor [options]

Produce a fast summary verdict and point the operator to review when action is needed.

Options:
  --workspace
  --verdict-only
  --json-file <path>`;
  }

  return `rainy-updates (rup / rainy-up) <command> [options]

Commands:
  check       Detect candidate updates
  doctor      Summarize what matters
  review      Decide what to do
  upgrade     Apply the approved change set
  dashboard   Open the interactive DevOps dashboard (Ink TUI)
  ci          Run CI-focused orchestration
  warm-cache  Warm local cache for fast/offline checks
  init-ci     Scaffold GitHub Actions workflow
  baseline    Save/check dependency baseline snapshots
  audit       Scan dependencies for CVEs (OSV.dev + GitHub)
  health      Detect stale/deprecated/unmaintained packages
  bisect      Find which version of a dep introduced a failure
  unused      Detect unused or missing npm dependencies
  resolve     Check peer dependency conflicts (pure-TS, no subprocess)
  licenses    Scan dependency licenses and generate SPDX SBOM
  snapshot    Save, list, restore, and diff dependency state snapshots

Global options:
  --cwd <path>
  --workspace
  --target patch|minor|major|latest
  --format table|json|minimal|github|metrics
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>
  --policy-file <path>
  --fail-on none|patch|minor|major|any
  --max-updates <n>
  --group-by none|name|scope|kind|risk
  --group-max <n>
  --cooldown-days <n>
  --pr-limit <n>
  --only-changed
  --interactive
  --show-impact
  --show-homepage
  --mode minimal|strict|enterprise
  --fix-pr
  --fix-branch <name>
  --fix-commit-message <text>
  --fix-dry-run
  --fix-pr-no-checkout
  --fix-pr-batch-size <n>
  --no-pr-report
  --log-level error|warn|info|debug
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --cache-ttl <seconds>
  --offline
  --stream
  --lockfile-mode preserve|update|error
  --ci
  --help, -h
  --version, -v`;
}

async function runCommand(
  parsed:
    | { command: "check"; options: CheckOptions }
    | { command: "upgrade"; options: UpgradeOptions }
    | { command: "warm-cache"; options: CheckOptions }
    | { command: "ci"; options: CheckOptions }
    | { command: "review"; options: ReviewOptions }
    | { command: "doctor"; options: DoctorOptions }
    | { command: "dashboard"; options: DashboardOptions },
): Promise<CheckResult> {
  if (parsed.command === "review") {
    const { runReview } = await import("../commands/review/runner.js");
    const result = await runReview(parsed.options);
    return {
      projectPath: result.projectPath,
      packagePaths: result.items.map((item) => item.update.packagePath),
      packageManager: "unknown",
      target: result.target,
      timestamp: new Date().toISOString(),
      summary: result.summary,
      updates: result.updates,
      errors: result.errors,
      warnings: result.warnings,
    };
  }

  if (parsed.command === "doctor") {
    const { runDoctor } = await import("../commands/doctor/runner.js");
    const result = await runDoctor(parsed.options);
    return {
      projectPath: result.review.projectPath,
      packagePaths: result.review.items.map((item) => item.update.packagePath),
      packageManager: "unknown",
      target: result.review.target,
      timestamp: new Date().toISOString(),
      summary: result.summary,
      updates: result.review.updates,
      errors: result.review.errors,
      warnings: result.review.warnings,
    };
  }

  if (parsed.command === "upgrade") {
    return await upgrade(parsed.options);
  }

  if (parsed.command === "warm-cache") {
    return await warmCache(parsed.options);
  }

  if (parsed.command === "ci") {
    return await runCi(parsed.options);
  }

  if (parsed.options.fixPr) {
    const upgradeOptions: UpgradeOptions = {
      ...parsed.options,
      install: false,
      packageManager: "auto",
      sync: false,
    };
    return await upgrade(upgradeOptions);
  }

  return await check(parsed.options);
}

async function readPackageVersion(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const packageJsonPath = path.resolve(
    path.dirname(currentFile),
    "../../package.json",
  );
  const content = await fs.readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(content) as { version?: string };
  return parsed.version ?? "0.0.0";
}

function resolveExitCode(result: CheckResult, failReason: FailReason): number {
  if (result.errors.length > 0) return 2;
  if (failReason !== "none") return 1;
  return 0;
}
