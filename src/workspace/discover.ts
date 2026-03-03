import path from "node:path";
import type { DependencyKind } from "../types/index.js";
import { scopePackageDirsByGit, type GitScopeOptions } from "../git/scope.js";

const HARD_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".turbo",
  ".next",
  "dist",
  "coverage",
]);
const MAX_DISCOVERED_DIRS = 20000;

export async function discoverPackageDirs(
  cwd: string,
  workspaceMode: boolean,
  options: {
    git?: GitScopeOptions;
    includeKinds?: DependencyKind[];
    includeDependents?: boolean;
  } = {},
): Promise<string[]> {
  if (!workspaceMode) {
    const scoped = await scopePackageDirsByGit(cwd, [cwd], options.git ?? {}, {
      includeKinds: options.includeKinds,
      includeDependents: options.includeDependents,
    });
    return scoped.packageDirs;
  }

  const roots = new Set<string>([cwd]);
  const patterns = [
    ...(await readPackageJsonWorkspacePatterns(cwd)),
    ...(await readPnpmWorkspacePatterns(cwd)),
  ];
  const include = patterns.filter((item) => !item.startsWith("!"));
  const exclude = patterns
    .filter((item) => item.startsWith("!"))
    .map((item) => item.slice(1));

  for (const pattern of include) {
    const dirs = await expandWorkspacePattern(cwd, pattern);
    for (const dir of dirs) {
      roots.add(dir);
    }
  }

  for (const pattern of exclude) {
    const dirs = await expandWorkspacePattern(cwd, pattern);
    for (const dir of dirs) {
      roots.delete(dir);
    }
  }

  const existing: string[] = [];
  for (const dir of roots) {
    const packageJsonPath = path.join(dir, "package.json");
    if (await packageFileExists(packageJsonPath)) {
      existing.push(dir);
    }
  }

  const scoped = await scopePackageDirsByGit(cwd, existing.sort(), options.git ?? {}, {
    includeKinds: options.includeKinds,
    includeDependents: options.includeDependents,
  });
  return scoped.packageDirs;
}

async function packageFileExists(packageJsonPath: string): Promise<boolean> {
  try {
    return await Bun.file(packageJsonPath).exists();
  } catch {
    return false;
  }
}

async function readPackageJsonWorkspacePatterns(
  cwd: string,
): Promise<string[]> {
  const packagePath = path.join(cwd, "package.json");

  try {
    const parsed = (await Bun.file(packagePath).json()) as {
      workspaces?: string[] | { packages?: string[] };
    };

    if (Array.isArray(parsed.workspaces)) {
      return parsed.workspaces;
    }

    if (parsed.workspaces && Array.isArray(parsed.workspaces.packages)) {
      return parsed.workspaces.packages;
    }

    return [];
  } catch {
    return [];
  }
}

async function readPnpmWorkspacePatterns(cwd: string): Promise<string[]> {
  const workspacePath = path.join(cwd, "pnpm-workspace.yaml");

  try {
    const content = await Bun.file(workspacePath).text();
    const lines = content.split(/\r?\n/);
    const patterns: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("-")) continue;
      const value = trimmed.replace(/^-\s*/, "").replace(/^['"]|['"]$/g, "");
      if (value.length > 0) {
        patterns.push(value);
      }
    }

    return patterns;
  } catch {
    return [];
  }
}

async function expandWorkspacePattern(
  cwd: string,
  pattern: string,
): Promise<string[]> {
  const normalized = pattern
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
  if (normalized.length === 0) return [];

  if (!normalized.includes("*")) {
    return [path.resolve(cwd, normalized)];
  }

  const results = new Set<string>();
  const manifestPattern = normalized.endsWith("/package.json")
    ? normalized
    : `${normalized}/package.json`;
  const glob = new Bun.Glob(manifestPattern);

  for await (const match of glob.scan({
    cwd,
    absolute: true,
    dot: false,
    onlyFiles: true,
  })) {
    const dir = path.dirname(match);
    if (shouldIgnoreWorkspaceDir(cwd, dir)) continue;
    results.add(dir);
    if (results.size > MAX_DISCOVERED_DIRS) {
      throw new Error(
        `Workspace discovery exceeded ${MAX_DISCOVERED_DIRS} directories. Refine workspace patterns.`,
      );
    }
  }

  return Array.from(results);
}

function shouldIgnoreWorkspaceDir(cwd: string, dir: string): boolean {
  const relative = path.relative(cwd, dir);
  if (relative.length === 0 || relative.startsWith("..")) {
    return false;
  }

  return relative
    .split(path.sep)
    .filter(Boolean)
    .some(
      (segment) =>
        HARD_IGNORE_DIRS.has(segment) || segment.startsWith("."),
    );
}
