import { parseCliArgs } from "../core/options.js";
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
import {
  getRuntimeArgv,
  setRuntimeExitCode,
  writeStderr,
  writeStdout,
} from "../utils/runtime.js";
import { CLI_VERSION } from "../generated/version.js";
import { handleDirectCommand, runPrimaryCommand } from "./dispatch.js";
import { renderHelp } from "./help.js";
import type { ParsedCliArgs } from "../core/options.js";
import { loadConfig } from "../config/loader.js";
import { readEnv } from "../utils/runtime.js";
import { runSelfUpdateService, formatSelfUpdateNotice } from "../services/self-update.js";

export async function runCli(): Promise<void> {
  try {
    const argv = getRuntimeArgv();
    if (argv.includes("--version") || argv.includes("-v")) {
      writeStdout((await readPackageVersion()) + "\n");
      return;
    }

    if (argv.includes("--help") || argv.includes("-h")) {
      writeStdout(renderHelp(argv[0]) + "\n");
      return;
    }

    const parsed = await parseCliArgs(argv);
    const selfUpdateNoticePromise = prepareSelfUpdateNotice(parsed);
    if (await handleDirectCommand(parsed)) {
      const selfUpdateNotice = await selfUpdateNoticePromise;
      if (selfUpdateNotice) {
        writeStdout(`\n${selfUpdateNotice}\n`);
      }
      return;
    }
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
        const { applyFixPrBatches } = await import("../core/fix-pr-batch.js");
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
        const { applyFixPr } = await import("../core/fix-pr.js");
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

    writeStdout(rendered + "\n");
    const selfUpdateNotice = await selfUpdateNoticePromise;
    if (selfUpdateNotice) {
      writeStdout(`\n${selfUpdateNotice}\n`);
    }

    setRuntimeExitCode(resolveExitCode(result, result.summary.failReason));
  } catch (error) {
    writeStderr(`rainy-updates (rup): ${String(error)}\n`);
    setRuntimeExitCode(2);
  }
}

async function prepareSelfUpdateNotice(parsed: ParsedCliArgs): Promise<string | null> {
  if (!process.stdout.isTTY) return null;
  if (parsed.command === "mcp" || parsed.command === "self-update") return null;
  if (readEnv("CI")) return null;
  if ("options" in parsed && "ci" in parsed.options && parsed.options.ci) return null;
  if ("options" in parsed && "format" in parsed.options) {
    const format = parsed.options.format;
    if (format === "json" || format === "github" || format === "metrics") return null;
  }
  if (readEnv("RAINY_UPDATES_SELF_UPDATE_CHECK") === "0") return null;

  const cwd = "options" in parsed && "cwd" in parsed.options
    ? parsed.options.cwd
    : process.cwd();
  const config = await loadConfig(cwd).catch(
    () => ({} as Awaited<ReturnType<typeof loadConfig>>),
  );
  if (config.selfUpdate?.check === "off") return null;

  const ttlHours = config.selfUpdate?.ttlHours ?? 24;
  const statusPromise = runSelfUpdateService({
    cwd,
    action: "check",
    yes: false,
    packageManager: "auto",
  }, { ttlHours });

  const status = await withTimeout(statusPromise, 500);
  if (!status) return null;
  return formatSelfUpdateNotice(status);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

async function readPackageVersion(): Promise<string> {
  return CLI_VERSION;
}

function resolveExitCode(result: CheckResult, failReason: FailReason): number {
  if (result.errors.length > 0) return 2;
  if (failReason !== "none") return 1;
  return 0;
}
