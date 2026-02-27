import { spawn } from "node:child_process";
import path from "node:path";
import type { CheckResult, RunOptions } from "../types/index.js";

export interface FixPrResult {
  applied: boolean;
  branchName?: string;
  commitSha?: string;
}

export async function applyFixPr(
  options: RunOptions,
  result: CheckResult,
  extraFiles: string[],
): Promise<FixPrResult> {
  if (!options.fixPr) return { applied: false };
  if (result.updates.length === 0) {
    return {
      applied: false,
      branchName: options.fixBranch ?? "chore/rainy-updates",
      commitSha: "",
    };
  }

  const status = await runGit(options.cwd, ["status", "--porcelain"]);
  if (status.stdout.trim().length > 0) {
    throw new Error("Cannot run --fix-pr with a dirty git working tree.");
  }

  const branch = options.fixBranch ?? "chore/rainy-updates";
  const headRef = await runGit(options.cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], true);
  if (headRef.code !== 0 && !options.fixPrNoCheckout) {
    throw new Error("Cannot run --fix-pr in detached HEAD state without --fix-pr-no-checkout.");
  }

  if (!options.fixPrNoCheckout) {
    const branchCheck = await runGit(options.cwd, ["rev-parse", "--verify", "--quiet", branch], true);
    if (branchCheck.code === 0) {
      await runGit(options.cwd, ["checkout", branch]);
    } else {
      await runGit(options.cwd, ["checkout", "-b", branch]);
    }
  }

  if (options.fixDryRun) {
    return {
      applied: false,
      branchName: branch,
      commitSha: "",
    };
  }

  const manifestFiles = Array.from(
    new Set(result.updates.map((update) => path.resolve(update.packagePath, "package.json"))),
  );
  const filesToStage = Array.from(
    new Set(
      [...manifestFiles, ...extraFiles]
        .map((entry) => path.resolve(options.cwd, entry))
        .filter((entry) => entry.startsWith(path.resolve(options.cwd) + path.sep) || entry === path.resolve(options.cwd)),
    ),
  ).sort((a, b) => a.localeCompare(b));
  if (filesToStage.length > 0) {
    await runGit(options.cwd, ["add", "--", ...filesToStage]);
  }

  const stagedCheck = await runGit(options.cwd, ["diff", "--cached", "--quiet"], true);
  if (stagedCheck.code === 0) {
    return {
      applied: false,
      branchName: branch,
      commitSha: "",
    };
  }

  const message = options.fixCommitMessage ?? `chore(deps): apply rainy-updates (${result.updates.length} updates)`;
  await runGit(options.cwd, ["commit", "-m", message]);
  const rev = await runGit(options.cwd, ["rev-parse", "HEAD"]);

  return {
    applied: true,
    branchName: branch,
    commitSha: rev.stdout.trim(),
  };
}

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runGit(cwd: string, args: string[], allowNonZero = false): Promise<GitResult> {
  return await new Promise<GitResult>((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: string | Uint8Array) => {
      stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    });
    child.stderr.on("data", (chunk: string | Uint8Array) => {
      stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      const normalized = code ?? 1;
      if (normalized !== 0 && !allowNonZero) {
        reject(new Error(`git ${args.join(" ")} failed (${normalized}): ${stderr.trim()}`));
        return;
      }
      resolve({ code: normalized, stdout, stderr });
    });
  });
}
