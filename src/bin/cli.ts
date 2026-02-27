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
import type { CheckOptions, CheckResult, FailReason, UpgradeOptions } from "../types/index.js";
import { writeFileAtomic } from "../utils/io.js";
import { resolveFailReason } from "../core/summary.js";
import { stableStringify } from "../utils/stable-json.js";

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
      const workflow = await initCiWorkflow(parsed.options.cwd, parsed.options.force, {
        mode: parsed.options.mode,
        schedule: parsed.options.schedule,
      });
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
        process.stdout.write(`Saved baseline at ${saved.filePath} (${saved.entries} entries)\n`);
        return;
      }

      const diff = await diffBaseline(parsed.options);
      const changes = diff.added.length + diff.removed.length + diff.changed.length;

      if (changes === 0) {
        process.stdout.write(`No baseline drift detected (${diff.filePath}).\n`);
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

    const result = await runCommand(parsed);

    if (parsed.options.prReportFile) {
      const markdown = renderPrReport(result);
      await writeFileAtomic(parsed.options.prReportFile, markdown + "\n");
    }

    if (parsed.options.fixPr && (parsed.command === "check" || parsed.command === "upgrade" || parsed.command === "ci")) {
      result.summary.fixPrApplied = false;
      result.summary.fixBranchName = parsed.options.fixBranch ?? "chore/rainy-updates";
      result.summary.fixCommitSha = "";
      result.summary.fixPrBranchesCreated = 0;

      if (parsed.command === "ci") {
        const batched = await applyFixPrBatches(parsed.options, result);
        result.summary.fixPrApplied = batched.applied;
        result.summary.fixBranchName = batched.branches[0] ?? (parsed.options.fixBranch ?? "chore/rainy-updates");
        result.summary.fixCommitSha = batched.commits[0] ?? "";
        result.summary.fixPrBranchesCreated = batched.branches.length;
        if (batched.branches.length > 1) {
          result.warnings.push(`Created ${batched.branches.length} fix-pr batch branches.`);
        }
      } else {
        const fixResult = await applyFixPr(
          parsed.options,
          result,
          parsed.options.prReportFile ? [parsed.options.prReportFile] : [],
        );
        result.summary.fixPrApplied = fixResult.applied;
        result.summary.fixBranchName = fixResult.branchName ?? "";
        result.summary.fixCommitSha = fixResult.commitSha ?? "";
        result.summary.fixPrBranchesCreated = fixResult.applied ? 1 : 0;
      }
    }

    result.summary.failReason = resolveFailReason(
      result.updates,
      result.errors,
      parsed.options.failOn,
      parsed.options.maxUpdates,
      parsed.options.ci,
    );

    const renderStartedAt = Date.now();
    let rendered = renderResult(result, parsed.options.format);
    result.summary.durationMs.render = Math.max(0, Date.now() - renderStartedAt);
    if (parsed.options.format === "json" || parsed.options.format === "metrics") {
      rendered = renderResult(result, parsed.options.format);
    }
    if (
      parsed.options.onlyChanged &&
      result.updates.length === 0 &&
      result.errors.length === 0 &&
      result.warnings.length === 0 &&
      (parsed.options.format === "table" || parsed.options.format === "minimal" || parsed.options.format === "github")
    ) {
      rendered = "";
    }

    if (parsed.options.jsonFile) {
      await writeFileAtomic(parsed.options.jsonFile, stableStringify(result, 2) + "\n");
    }

    if (parsed.options.githubOutputFile) {
      await writeGitHubOutput(parsed.options.githubOutputFile, result);
    }

    if (parsed.options.sarifFile) {
      const sarif = createSarifReport(result);
      await writeFileAtomic(parsed.options.sarifFile, stableStringify(sarif, 2) + "\n");
    }

    process.stdout.write(rendered + "\n");

    process.exitCode = resolveExitCode(result, result.summary.failReason);
  } catch (error) {
    process.stderr.write(`rainy-updates: ${String(error)}\n`);
    process.exitCode = 2;
  }
}

void main();

function renderHelp(command?: string): string {
  const isCommand = command && !command.startsWith("-");
  if (isCommand && command === "check") {
    return `rainy-updates check [options]

Detect available dependency updates.

Options:
  --workspace
  --target patch|minor|major|latest
  --filter <pattern>
  --reject <pattern>
  --dep-kinds deps,dev,optional,peer
  --concurrency <n>
  --cache-ttl <seconds>
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
  --cache-ttl <seconds>
  --offline
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>`;
  }

  if (isCommand && command === "upgrade") {
    return `rainy-updates upgrade [options]

Apply dependency updates to package.json manifests.

Options:
  --workspace
  --sync
  --install
  --pm auto|npm|pnpm
  --target patch|minor|major|latest
  --policy-file <path>
  --concurrency <n>
  --fix-pr
  --fix-branch <name>
  --fix-commit-message <text>
  --fix-dry-run
  --fix-pr-no-checkout
  --fix-pr-batch-size <n>
  --no-pr-report
  --json-file <path>
  --pr-report-file <path>`;
  }

  if (isCommand && command === "ci") {
    return `rainy-updates ci [options]

Run CI-oriented dependency automation pipeline.

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

  return `rainy-updates <command> [options]

Commands:
  check       Detect available updates
  upgrade     Apply updates to manifests
  ci          Run CI-focused update pipeline
  warm-cache  Warm local cache for fast/offline checks
  init-ci     Scaffold GitHub Actions workflow
  baseline    Save/check dependency baseline snapshots

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
  --cache-ttl <seconds>
  --offline
  --ci
  --help, -h
  --version, -v`;
}

async function runCommand(
  parsed:
    | { command: "check"; options: CheckOptions }
    | { command: "upgrade"; options: UpgradeOptions }
    | { command: "warm-cache"; options: CheckOptions }
    | { command: "ci"; options: CheckOptions },
): Promise<CheckResult> {
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
  const packageJsonPath = path.resolve(path.dirname(currentFile), "../../package.json");
  const content = await fs.readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(content) as { version?: string };
  return parsed.version ?? "0.0.0";
}

function resolveExitCode(result: CheckResult, failReason: FailReason): number {
  if (result.errors.length > 0) return 2;
  if (failReason !== "none") return 1;
  return 0;
}
