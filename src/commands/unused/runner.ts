import path from "node:path";
import {
  readManifest,
  collectDependencies,
} from "../../parsers/package-json.js";
import { discoverPackageDirs } from "../../workspace/discover.js";
import { writeFileAtomic } from "../../utils/io.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeStderr, writeStdout } from "../../utils/runtime.js";
import type {
  UnusedOptions,
  UnusedResult,
  UnusedDependency,
} from "../../types/index.js";
import { scanDirectory } from "./scanner.js";
import { matchDependencies, removeUnusedFromManifest } from "./matcher.js";

/**
 * Entry point for `rup unused`. Lazy-loaded by cli.ts.
 *
 * Strategy:
 *   1. Collect all source directories to scan
 *   2. Scan them in parallel for imported package names
 *   3. Cross-reference against package.json declarations
 *   4. Optionally apply --fix (remove unused from package.json)
 */
export async function runUnused(options: UnusedOptions): Promise<UnusedResult> {
  const result: UnusedResult = {
    unused: [],
    missing: [],
    totalUnused: 0,
    totalMissing: 0,
    errors: [],
    warnings: [],
  };

  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace, {
    git: options,
    includeDependents: false,
  });

  for (const packageDir of packageDirs) {
    // ─ Read manifest ─────────────────────────────────────────────────────────
    let manifest;
    try {
      manifest = await readManifest(packageDir);
    } catch (error) {
      result.errors.push(
        `Failed to read package.json in ${packageDir}: ${String(error)}`,
      );
      continue;
    }

    // ─ Scan source directories for imports ───────────────────────────────────
    const allImports = new Set<string>();
    for (const srcDir of options.srcDirs) {
      const scanTarget = path.isAbsolute(srcDir)
        ? srcDir
        : path.join(packageDir, srcDir);
      const found = await scanDirectory(scanTarget);
      for (const name of found) allImports.add(name);
    }

    // Fallback: if no src dir exists, scan the package root itself
    if (allImports.size === 0) {
      const rootImports = await scanDirectory(packageDir);
      for (const name of rootImports) allImports.add(name);
    }

    // ─ Match declared vs imported ─────────────────────────────────────────────
    const { unused, missing } = matchDependencies(
      manifest,
      allImports,
      packageDir,
      {
        includeDevDependencies: options.includeDevDependencies,
      },
    );

    result.unused.push(...unused);
    result.missing.push(...missing);

    // ─ Apply fix ─────────────────────────────────────────────────────────────
    if (options.fix && unused.length > 0) {
      if (options.dryRun) {
        writeStderr(
          `[unused] --dry-run: would remove ${unused.length} unused dep(s) from ${packageDir}/package.json\n`,
        );
      } else {
        try {
          const manifestPath = path.join(packageDir, "package.json");
          const originalJson = await Bun.file(manifestPath).text();
          const updatedJson = removeUnusedFromManifest(originalJson, unused);
          await writeFileAtomic(manifestPath, updatedJson);
          writeStderr(
            `[unused] Removed ${unused.length} unused dep(s) from ${packageDir}/package.json\n`,
          );
        } catch (error) {
          result.errors.push(
            `Failed to update package.json in ${packageDir}: ${String(error)}`,
          );
        }
      }
    }
  }

  result.totalUnused = result.unused.length;
  result.totalMissing = result.missing.length;

  // ─ Render output ─────────────────────────────────────────────────────────
  writeStdout(renderUnusedTable(result) + "\n");

  // ─ JSON report ───────────────────────────────────────────────────────────
  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
    writeStderr(
      `[unused] JSON report written to ${options.jsonFile}\n`,
    );
  }

  return result;
}

function renderUnusedTable(result: UnusedResult): string {
  const lines: string[] = [];

  if (result.unused.length === 0 && result.missing.length === 0) {
    return "✔ No unused or missing dependencies found.";
  }

  if (result.unused.length > 0) {
    lines.push(
      `\n⚠ Unused dependencies (${result.unused.length}) — declared but never imported:\n`,
    );
    lines.push("  " + "Package".padEnd(35) + "Declared in");
    lines.push("  " + "─".repeat(55));
    for (const dep of result.unused) {
      lines.push("  " + dep.name.padEnd(35) + (dep.declaredIn ?? ""));
    }
  }

  if (result.missing.length > 0) {
    lines.push(
      `\n✖ Missing dependencies (${result.missing.length}) — imported but not declared:\n`,
    );
    lines.push("  " + "Package".padEnd(35) + "Imported from");
    lines.push("  " + "─".repeat(55));
    for (const dep of result.missing) {
      lines.push("  " + dep.name.padEnd(35) + (dep.importedFrom ?? ""));
    }
  }

  return lines.join("\n");
}
