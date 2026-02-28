import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Extracts all imported package names from a single source file.
 *
 * Handles:
 *   - ESM static:  import ... from "pkg"
 *   - ESM dynamic: import("pkg")
 *   - CJS:         require("pkg")
 *
 * Strips subpath imports (e.g. "lodash/merge" → "lodash"),
 * skips relative imports and node: builtins.
 */
export function extractImportsFromSource(source: string): Set<string> {
  const names = new Set<string>();

  // ESM static import: from "pkg" or from 'pkg'
  const staticImport = /from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(staticImport)) {
    addPackageName(names, match[1]);
  }

  // ESM dynamic import: import("pkg") or import('pkg')
  const dynamicImport = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(dynamicImport)) {
    addPackageName(names, match[1]);
  }

  // CJS require: require("pkg") or require('pkg')
  const cjsRequire = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(cjsRequire)) {
    addPackageName(names, match[1]);
  }

  // export ... from "pkg"
  const reExport = /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(reExport)) {
    addPackageName(names, match[1]);
  }

  return names;
}

function addPackageName(names: Set<string>, specifier: string): void {
  // Skip relative imports, node: builtins, and bare file paths
  if (specifier.startsWith(".") || specifier.startsWith("/")) return;
  if (specifier.startsWith("node:")) return;
  if (specifier.startsWith("bun:")) return;

  // Normalize package name (strip subpath): "lodash/merge" → "lodash"
  // "@scope/pkg/subpath" → "@scope/pkg"
  const name = extractPackageName(specifier);
  if (name) names.add(name);
}

export function extractPackageName(specifier: string): string | null {
  if (!specifier) return null;
  if (specifier.startsWith("@")) {
    // Scoped: @scope/pkg or @scope/pkg/subpath
    const parts = specifier.split("/");
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }
  // Unscoped: pkg or pkg/subpath
  return specifier.split("/")[0] ?? null;
}

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
]);

/**
 * Recursively scans a directory and returns all imported package names
 * found across all source files.
 */
export async function scanDirectory(dir: string): Promise<Set<string>> {
  const allImports = new Set<string>();
  await walkDirectory(dir, allImports);
  return allImports;
}

async function walkDirectory(
  dir: string,
  collector: Set<string>,
): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }

  const tasks: Promise<void>[] = [];

  for (const entryName of entries) {
    if (IGNORED_DIRS.has(entryName)) continue;
    const fullPath = path.join(dir, entryName);

    tasks.push(
      fs
        .stat(fullPath)
        .then((stat) => {
          if (stat.isDirectory()) {
            return walkDirectory(fullPath, collector);
          }
          if (stat.isFile()) {
            const ext = path.extname(entryName).toLowerCase();
            if (!SOURCE_EXTENSIONS.has(ext)) return;
            return fs
              .readFile(fullPath, "utf8")
              .then((source) => {
                for (const name of extractImportsFromSource(source)) {
                  collector.add(name);
                }
              })
              .catch(() => undefined);
          }
        })
        .catch(() => undefined),
    );
  }

  await Promise.all(tasks);
}
