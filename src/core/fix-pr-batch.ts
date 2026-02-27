import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CheckResult, GroupBy, PackageManifest, PackageUpdate, RunOptions } from "../types/index.js";
import { readManifest, writeManifest } from "../parsers/package-json.js";

export interface FixPrBatchResult {
  applied: boolean;
  branches: string[];
  commits: string[];
}

interface UpdateGroup {
  key: string;
  items: PackageUpdate[];
}

interface PlannedBatch {
  index: number;
  groups: UpdateGroup[];
  updates: PackageUpdate[];
  branchName: string;
}

export async function applyFixPrBatches(options: RunOptions, result: CheckResult): Promise<FixPrBatchResult> {
  const autofixUpdates = result.updates.filter((update) => update.autofix !== false);
  if (!options.fixPr || autofixUpdates.length === 0) {
    return { applied: false, branches: [], commits: [] };
  }

  const baseRef = await resolveBaseRef(options.cwd, options.fixPrNoCheckout);
  const groups = groupUpdates(autofixUpdates, options.groupBy);
  const plans = planFixPrBatches(groups, options.fixBranch ?? "chore/rainy-updates", options.fixPrBatchSize ?? 1);

  if (options.fixDryRun) {
    return { applied: false, branches: plans.map((plan) => plan.branchName), commits: [] };
  }

  const branches: string[] = [];
  const commits: string[] = [];

  for (const plan of plans) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rainy-fix-pr-batch-"));
    try {
      await runGit(options.cwd, ["worktree", "add", "-B", plan.branchName, tempDir, baseRef]);
      await applyUpdatesInWorktree(options.cwd, tempDir, plan.updates);
      await stageUpdatedManifests(options.cwd, tempDir, plan.updates);
      const message = renderCommitMessage(options, plan, plans.length);
      await runGit(tempDir, ["commit", "-m", message]);
      const rev = await runGit(tempDir, ["rev-parse", "HEAD"]);
      branches.push(plan.branchName);
      commits.push(rev.stdout.trim());
    } finally {
      await runGit(options.cwd, ["worktree", "remove", "--force", tempDir], true);
    }
  }

  return {
    applied: branches.length > 0,
    branches,
    commits,
  };
}

export function planFixPrBatches(groups: UpdateGroup[], baseBranch: string, batchSize: number): PlannedBatch[] {
  if (groups.length === 0) return [];
  const size = Math.max(1, Math.floor(batchSize));
  const chunks: UpdateGroup[][] = [];
  for (let index = 0; index < groups.length; index += size) {
    chunks.push(groups.slice(index, index + size));
  }

  return chunks.map((chunk, index) => {
    const suffix = chunk.length === 1 ? sanitizeBranchToken(chunk[0]?.key ?? `batch-${index + 1}`) : `batch-${index + 1}`;
    return {
      index: index + 1,
      groups: chunk,
      updates: chunk.flatMap((item) => item.items),
      branchName: `${baseBranch}-${suffix}`,
    };
  });
}

function groupUpdates(updates: PackageUpdate[], groupBy: GroupBy): UpdateGroup[] {
  if (updates.length === 0) return [];
  if (groupBy === "none") {
    return [{ key: "all", items: sortUpdates(updates) }];
  }

  const byGroup = new Map<string, PackageUpdate[]>();
  for (const update of updates) {
    const key = groupKey(update, groupBy);
    byGroup.set(key, [...(byGroup.get(key) ?? []), update]);
  }

  return Array.from(byGroup.entries())
    .map(([key, items]) => ({ key, items: sortUpdates(items) }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function groupKey(update: PackageUpdate, groupBy: GroupBy): string {
  if (groupBy === "name") return update.name;
  if (groupBy === "kind") return update.kind;
  if (groupBy === "risk") return update.diffType;
  if (groupBy === "scope") {
    if (update.name.startsWith("@")) {
      const slash = update.name.indexOf("/");
      if (slash > 1) return update.name.slice(0, slash);
    }
    return "unscoped";
  }
  return "all";
}

function sortUpdates(updates: PackageUpdate[]): PackageUpdate[] {
  return [...updates].sort((left, right) => {
    const byPath = left.packagePath.localeCompare(right.packagePath);
    if (byPath !== 0) return byPath;
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    return left.kind.localeCompare(right.kind);
  });
}

async function resolveBaseRef(cwd: string, allowDetached: boolean | undefined): Promise<string> {
  const status = await runGit(cwd, ["status", "--porcelain"]);
  if (status.stdout.trim().length > 0) {
    throw new Error("Cannot run --fix-pr with a dirty git working tree.");
  }

  const headRef = await runGit(cwd, ["symbolic-ref", "--quiet", "--short", "HEAD"], true);
  if (headRef.code === 0) {
    return headRef.stdout.trim();
  }
  if (!allowDetached) {
    throw new Error("Cannot run --fix-pr in detached HEAD state without --fix-pr-no-checkout.");
  }
  const rev = await runGit(cwd, ["rev-parse", "HEAD"]);
  return rev.stdout.trim();
}

async function applyUpdatesInWorktree(rootCwd: string, worktreeCwd: string, updates: PackageUpdate[]): Promise<void> {
  const manifestsByPath = new Map<string, PackageManifest>();

  for (const update of updates) {
    const relativePackagePath = path.relative(rootCwd, update.packagePath);
    const targetPackagePath = path.resolve(worktreeCwd, relativePackagePath);
    let manifest = manifestsByPath.get(targetPackagePath);
    if (!manifest) {
      manifest = await readManifest(targetPackagePath);
      manifestsByPath.set(targetPackagePath, manifest);
    }

    const section = manifest[update.kind] as Record<string, string> | undefined;
    if (!section || !section[update.name]) continue;
    section[update.name] = update.toRange;
  }

  for (const [manifestPath, manifest] of manifestsByPath) {
    await writeManifest(manifestPath, manifest);
  }
}

async function stageUpdatedManifests(rootCwd: string, worktreeCwd: string, updates: PackageUpdate[]): Promise<void> {
  const files = Array.from(
    new Set(
      updates.map((update) => {
        const relativePackagePath = path.relative(rootCwd, update.packagePath);
        return path.resolve(worktreeCwd, relativePackagePath, "package.json");
      }),
    ),
  ).sort((a, b) => a.localeCompare(b));

  if (files.length > 0) {
    await runGit(worktreeCwd, ["add", "--", ...files]);
  }
}

function renderCommitMessage(options: RunOptions, plan: PlannedBatch, totalBatches: number): string {
  const baseMessage = options.fixCommitMessage ?? `chore(deps): apply rainy-updates batch`;
  return `${baseMessage} (${plan.index}/${totalBatches}, ${plan.updates.length} updates)`;
}

function sanitizeBranchToken(value: string): string {
  return value.replace(/^@/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "batch";
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
