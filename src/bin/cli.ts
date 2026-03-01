#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "../core/options.js";
import { applyFixPr } from "../core/fix-pr.js";
import { applyFixPrBatches } from "../core/fix-pr-batch.js";
import { createRunId, writeArtifactManifest } from "../core/artifacts.js";
import { renderResult } from "../output/format.js";
import { writeGitHubOutput } from "../output/github.js";
import { createSarifReport } from "../output/sarif.js";
import { renderPrReport } from "../output/pr-report.js";
import type {
  CheckResult,
  FailReason,
} from "../types/index.js";
import { writeFileAtomic } from "../utils/io.js";
import { resolveFailReason } from "../core/summary.js";
import { stableStringify } from "../utils/stable-json.js";
import { handleDirectCommand, runPrimaryCommand } from "./dispatch.js";
import { renderHelp } from "./help.js";

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
    if (await handleDirectCommand(parsed)) return;
    if (
      parsed.command !== "check" &&
      parsed.command !== "upgrade" &&
      parsed.command !== "warm-cache" &&
      parsed.command !== "ci"
    ) {
      throw new Error(`Unhandled command: ${parsed.command}`);
    }

    const result = await runPrimaryCommand(parsed);
    result.summary.runId = createRunId(parsed.command, parsed.options, result);

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

    const artifactManifest = await writeArtifactManifest(
      parsed.command,
      parsed.options,
      result,
    );
    if (artifactManifest) {
      result.summary.artifactManifest = artifactManifest.artifactManifestPath;
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
