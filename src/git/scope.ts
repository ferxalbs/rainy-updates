import path from "node:path";
import { readManifest } from "../parsers/package-json.js";
import type { DependencyKind, PackageManifest } from "../types/index.js";
import { buildWorkspaceGraph } from "../workspace/graph.js";

export interface GitScopeOptions {
  onlyChanged?: boolean;
  affected?: boolean;
  staged?: boolean;
  baseRef?: string;
  headRef?: string;
  sinceRef?: string;
}

export interface ScopedPackageDirsResult {
  packageDirs: string[];
  warnings: string[];
  changedFiles: string[];
}

export function hasGitScope(options: GitScopeOptions): boolean {
  return (
    options.onlyChanged === true ||
    options.affected === true ||
    options.staged === true ||
    typeof options.baseRef === "string" ||
    typeof options.headRef === "string" ||
    typeof options.sinceRef === "string"
  );
}

export async function scopePackageDirsByGit(
  cwd: string,
  packageDirs: string[],
  options: GitScopeOptions,
  config: {
    includeKinds?: DependencyKind[];
    includeDependents?: boolean;
  } = {},
): Promise<ScopedPackageDirsResult> {
  if (!hasGitScope(options)) {
    return {
      packageDirs,
      warnings: [],
      changedFiles: [],
    };
  }

  const changedFiles = await listChangedFiles(cwd, options);
  if ("warnings" in changedFiles) {
    return {
      packageDirs,
      warnings: changedFiles.warnings,
      changedFiles: [],
    };
  }

  const changedPackageDirs = mapFilesToPackageDirs(cwd, packageDirs, changedFiles.files);
  if (changedPackageDirs.length === 0) {
    return {
      packageDirs: [],
      warnings: [],
      changedFiles: changedFiles.files,
    };
  }

  if (!config.includeDependents) {
    return {
      packageDirs: changedPackageDirs,
      warnings: [],
      changedFiles: changedFiles.files,
    };
  }

  const affectedPackageDirs = await expandToDependents(
    changedPackageDirs,
    packageDirs,
    config.includeKinds ?? ["dependencies", "devDependencies"],
  );

  return {
    packageDirs: affectedPackageDirs,
    warnings: [],
    changedFiles: changedFiles.files,
  };
}

async function listChangedFiles(
  cwd: string,
  options: GitScopeOptions,
): Promise<{ files: string[] } | { warnings: string[] }> {
  const primaryArgs = buildGitDiffArgs(options);
  const diff = await runGit(cwd, primaryArgs);
  if (!diff.ok) {
    return {
      warnings: [
        `Git scope could not be resolved (${diff.error}). Falling back to full workspace scan.`,
      ],
    };
  }

  const untracked = await runGit(cwd, ["ls-files", "--others", "--exclude-standard"]);
  const files = new Set<string>();

  for (const value of [...diff.lines, ...(untracked.ok ? untracked.lines : [])]) {
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    files.add(trimmed);
  }

  return {
    files: Array.from(files).sort((left, right) => left.localeCompare(right)),
  };
}

function buildGitDiffArgs(options: GitScopeOptions): string[] {
  if (options.staged) {
    return ["diff", "--name-only", "--cached"];
  }

  if (options.baseRef && options.headRef) {
    return ["diff", "--name-only", `${options.baseRef}...${options.headRef}`];
  }

  if (options.baseRef) {
    return ["diff", "--name-only", `${options.baseRef}...HEAD`];
  }

  if (options.sinceRef) {
    return ["diff", "--name-only", `${options.sinceRef}..HEAD`];
  }

  return ["diff", "--name-only", "HEAD"];
}

async function runGit(
  cwd: string,
  args: string[],
): Promise<{ ok: true; lines: string[] } | { ok: false; error: string }> {
  try {
    const proc = Bun.spawn(["git", ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (exitCode !== 0) {
      const message = stderr.trim() || `git ${args.join(" ")} exited with code ${exitCode}`;
      return { ok: false, error: message };
    }

    return {
      ok: true,
      lines: stdout.split(/\r?\n/).filter(Boolean),
    };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function mapFilesToPackageDirs(
  cwd: string,
  packageDirs: string[],
  files: string[],
): string[] {
  const sortedDirs = [...packageDirs].sort((left, right) => right.length - left.length);
  const matched = new Set<string>();

  for (const file of files) {
    const absoluteFile = path.resolve(cwd, file);
    let bestMatch: string | undefined;

    for (const packageDir of sortedDirs) {
      const relative = path.relative(packageDir, absoluteFile);
      if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
        bestMatch = packageDir;
        break;
      }
    }

    if (bestMatch) {
      matched.add(bestMatch);
    }
  }

  return Array.from(matched).sort((left, right) => left.localeCompare(right));
}

async function expandToDependents(
  changedPackageDirs: string[],
  packageDirs: string[],
  includeKinds: DependencyKind[],
): Promise<string[]> {
  const manifestsByPath = new Map<string, PackageManifest>();

  for (const packageDir of packageDirs) {
    try {
      manifestsByPath.set(packageDir, await readManifest(packageDir));
    } catch {
      // Skip unreadable manifests; callers already handle manifest read failures.
    }
  }

  const graph = buildWorkspaceGraph(manifestsByPath, includeKinds);
  const pathByName = new Map(
    graph.nodes.map((node) => [node.packageName, node.packagePath] as const),
  );
  const nameByPath = new Map(
    graph.nodes.map((node) => [node.packagePath, node.packageName] as const),
  );
  const dependents = new Map<string, string[]>();

  for (const node of graph.nodes) {
    for (const dependency of node.dependsOn) {
      const list = dependents.get(dependency) ?? [];
      list.push(node.packageName);
      dependents.set(dependency, list);
    }
  }

  const selected = new Set(changedPackageDirs);
  const queue = changedPackageDirs
    .map((packageDir) => nameByPath.get(packageDir))
    .filter((value): value is string => typeof value === "string");

  while (queue.length > 0) {
    const current = queue.shift() as string;

    for (const dependent of dependents.get(current) ?? []) {
      const dependentPath = pathByName.get(dependent);
      if (!dependentPath || selected.has(dependentPath)) continue;
      selected.add(dependentPath);
      queue.push(dependent);
    }
  }

  return Array.from(selected).sort((left, right) => left.localeCompare(right));
}
