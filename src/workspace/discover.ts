import { promises as fs } from "node:fs";
import path from "node:path";

export async function discoverPackageDirs(cwd: string, workspaceMode: boolean): Promise<string[]> {
  if (!workspaceMode) {
    return [cwd];
  }

  const roots = new Set<string>([cwd]);

  const packagePatterns = await readPackageJsonWorkspacePatterns(cwd);
  const pnpmPatterns = await readPnpmWorkspacePatterns(cwd);

  for (const pattern of [...packagePatterns, ...pnpmPatterns]) {
    const dirs = await expandSingleLevelPattern(cwd, pattern);
    for (const dir of dirs) {
      roots.add(dir);
    }
  }

  const existing: string[] = [];
  for (const dir of roots) {
    const packageJsonPath = path.join(dir, "package.json");
    try {
      await fs.access(packageJsonPath);
      existing.push(dir);
    } catch {
      // ignore
    }
  }

  return existing.sort();
}

async function readPackageJsonWorkspacePatterns(cwd: string): Promise<string[]> {
  const packagePath = path.join(cwd, "package.json");

  try {
    const content = await fs.readFile(packagePath, "utf8");
    const parsed = JSON.parse(content) as {
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
    const content = await fs.readFile(workspacePath, "utf8");
    const lines = content.split(/\r?\n/);
    const patterns: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("-")) continue;
      const value = trimmed.replace(/^-\s*/, "").replace(/^['\"]|['\"]$/g, "");
      if (value.length > 0) {
        patterns.push(value);
      }
    }

    return patterns;
  } catch {
    return [];
  }
}

async function expandSingleLevelPattern(cwd: string, pattern: string): Promise<string[]> {
  if (!pattern.includes("*")) {
    return [path.resolve(cwd, pattern)];
  }

  const normalized = pattern.replace(/\\/g, "/");
  const starIndex = normalized.indexOf("*");
  const basePart = normalized.slice(0, starIndex).replace(/\/$/, "");
  const suffix = normalized.slice(starIndex + 1);

  if (suffix.length > 0 && suffix !== "/") {
    return [];
  }

  const baseDir = path.resolve(cwd, basePart);

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(baseDir, entry.name));
  } catch {
    return [];
  }
}
