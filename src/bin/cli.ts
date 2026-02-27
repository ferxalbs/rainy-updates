#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "../core/options.js";
import { check } from "../core/check.js";
import { upgrade } from "../core/upgrade.js";
import { warmCache } from "../core/warm-cache.js";
import { initCiWorkflow } from "../core/init-ci.js";
import { renderResult } from "../output/format.js";
import { writeGitHubOutput } from "../output/github.js";
import { createSarifReport } from "../output/sarif.js";
import { renderPrReport } from "../output/pr-report.js";

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
      const workflow = await initCiWorkflow(parsed.options.cwd, parsed.options.force);
      process.stdout.write(
        workflow.created
          ? `Created CI workflow at ${workflow.path}\n`
          : `CI workflow already exists at ${workflow.path}. Use --force to overwrite.\n`,
      );
      return;
    }

    const result =
      parsed.command === "upgrade"
        ? await upgrade(parsed.options)
        : parsed.command === "warm-cache"
          ? await warmCache(parsed.options)
          : await check(parsed.options);

    const rendered = renderResult(result, parsed.options.format);
    process.stdout.write(rendered + "\n");

    if (parsed.options.jsonFile) {
      await fs.mkdir(path.dirname(parsed.options.jsonFile), { recursive: true });
      await fs.writeFile(parsed.options.jsonFile, JSON.stringify(result, null, 2) + "\n", "utf8");
    }

    if (parsed.options.prReportFile) {
      const markdown = renderPrReport(result);
      await fs.mkdir(path.dirname(parsed.options.prReportFile), { recursive: true });
      await fs.writeFile(parsed.options.prReportFile, markdown + "\n", "utf8");
    }

    if (parsed.options.githubOutputFile) {
      await writeGitHubOutput(parsed.options.githubOutputFile, result);
    }

    if (parsed.options.sarifFile) {
      const sarif = createSarifReport(result);
      await fs.mkdir(path.dirname(parsed.options.sarifFile), { recursive: true });
      await fs.writeFile(parsed.options.sarifFile, JSON.stringify(sarif, null, 2) + "\n", "utf8");
    }

    if (parsed.options.ci && result.updates.length > 0) {
      process.exitCode = 1;
      return;
    }

    if (result.errors.length > 0) {
      process.exitCode = 2;
    }
  } catch (error) {
    process.stderr.write(`rainy-updates: ${String(error)}\n`);
    process.exitCode = 2;
  }
}

void main();

function renderHelp(command?: string): string {
  const isCommand = command && !command.startsWith("-");
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
  --json-file <path>
  --pr-report-file <path>`;
  }

  if (isCommand && command === "init-ci") {
    return `rainy-updates init-ci [--force]

Create a GitHub Actions workflow template at:
  .github/workflows/rainy-updates.yml`;
  }

  return `rainy-updates <command> [options]

Commands:
  check       Detect available updates
  upgrade     Apply updates to manifests
  warm-cache  Warm local cache for fast/offline checks
  init-ci     Scaffold GitHub Actions workflow

Global options:
  --cwd <path>
  --workspace
  --target patch|minor|major|latest
  --format table|json|minimal|github
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>
  --policy-file <path>
  --concurrency <n>
  --cache-ttl <seconds>
  --offline
  --ci
  --help, -h
  --version, -v`;
}

async function readPackageVersion(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const packageJsonPath = path.resolve(path.dirname(currentFile), "../../package.json");
  const content = await fs.readFile(packageJsonPath, "utf8");
  const parsed = JSON.parse(content) as { version?: string };
  return parsed.version ?? "0.0.0";
}
