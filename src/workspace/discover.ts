import { promises as fs } from "node:fs";
import path from "node:path";

export async function discoverPackageDirs(cwd: string, workspaceMode: boolean): Promise<string[]> {
  if (!workspaceMode) {
    return [cwd];
  }

  const roots = new Set<string>([cwd]);
  const patterns = [...(await readPackageJsonWorkspacePatterns(cwd)), ...(await readPnpmWorkspacePatterns(cwd))];
  const include = patterns.filter((item) => !item.startsWith("!"));
  const exclude = patterns.filter((item) => item.startsWith("!")).map((item) => item.slice(1));

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
    try {
      await fs.access(packageJsonPath);
      existing.push(dir);
    } catch {
      // ignore missing package.json
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

async function expandWorkspacePattern(cwd: string, pattern: string): Promise<string[]> {
  const normalized = pattern.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (normalized.length === 0) return [];

  if (!normalized.includes("*")) {
    return [path.resolve(cwd, normalized)];
  }

  const segments = normalized.split("/").filter(Boolean);
  const results = new Set<string>();
  await collectMatches(path.resolve(cwd), segments, 0, results);
  return Array.from(results);
}

async function collectMatches(baseDir: string, segments: string[], index: number, out: Set<string>): Promise<void> {
  if (index >= segments.length) {
    out.add(baseDir);
    return;
  }

  const segment = segments[index];
  if (segment === "**") {
    await collectMatches(baseDir, segments, index + 1, out);
    const children = await readChildDirs(baseDir);
    for (const child of children) {
      await collectMatches(child, segments, index, out);
    }
    return;
  }

  if (segment === "*") {
    const children = await readChildDirs(baseDir);
    for (const child of children) {
      await collectMatches(child, segments, index + 1, out);
    }
    return;
  }

  await collectMatches(path.join(baseDir, segment), segments, index + 1, out);
}

async function readChildDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => entry.name !== "node_modules" && !entry.name.startsWith("."))
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}
