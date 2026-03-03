import path from "node:path";
import { parseSync } from "oxc-parser";

/**
 * Extracts all imported package names from a single source file using AST.
 *
 * Handles:
 *   - ESM static:  import ... from "pkg"
 *   - ESM dynamic: import("pkg")
 *   - CJS:         require("pkg")
 *   - ESM re-export: export ... from "pkg"
 *
 * Strips subpath imports (e.g. "lodash/merge" → "lodash"),
 * skips relative imports and node: builtins.
 */
export function extractImportsFromSource(source: string): Set<string> {
  const names = new Set<string>();

  try {
    const parseResult = parseSync("unknown.ts", source, {
      sourceType: "module",
    });

    const walk = (node: any) => {
      if (!node) return;

      if (node.type === "ImportDeclaration" && node.source?.value) {
        addPackageName(names, node.source.value);
      } else if (node.type === "ExportNamedDeclaration" && node.source?.value) {
        addPackageName(names, node.source.value);
      } else if (node.type === "ExportAllDeclaration" && node.source?.value) {
        addPackageName(names, node.source.value);
      } else if (node.type === "ImportExpression" && node.source?.value) {
        addPackageName(names, node.source.value);
      } else if (node.type === "CallExpression") {
        if (
          node.callee?.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments?.[0]?.type === "StringLiteral"
        ) {
          addPackageName(names, node.arguments[0].value);
        }
      }

      // Traverse children
      for (const key in node) {
        if (node[key] && typeof node[key] === "object") {
          if (Array.isArray(node[key])) {
            for (const child of node[key]) {
              walk(child);
            }
          } else {
            walk(node[key]);
          }
        }
      }
    };

    walk(parseResult.program);
  } catch (err) {
    // Fallback or ignore parse errors
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
  const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}");

  const tasks: Promise<void>[] = [];

  for await (const file of glob.scan(dir)) {
    // Bun.Glob returns relative paths
    const fullPath = path.join(dir, file);

    // Quick check to ignore certain directories in the path
    if (
      fullPath.includes("/node_modules/") ||
      fullPath.includes("/.git/") ||
      fullPath.includes("/dist/") ||
      fullPath.includes("/build/") ||
      fullPath.includes("/out/") ||
      fullPath.includes("/.next/") ||
      fullPath.includes("/.nuxt/")
    ) {
      continue;
    }

    tasks.push(
      Bun.file(fullPath)
        .text()
        .then((source) => {
          for (const name of extractImportsFromSource(source)) {
            allImports.add(name);
          }
        })
        .catch(() => undefined),
    );
  }

  await Promise.all(tasks);
  return allImports;
}
