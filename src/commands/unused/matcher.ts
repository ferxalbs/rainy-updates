import type { PackageManifest } from "../../types/index.js";
import type { UnusedDependency, UnusedKind } from "../../types/index.js";

/**
 * Cross-references declared package.json dependencies against imported package names
 * to surface two classes of problems:
 *
 *   - "declared-not-imported": in package.json but never imported in source
 *   - "imported-not-declared": imported in source but absent from package.json
 */
export interface MatchOptions {
  includeDevDependencies: boolean;
}

export function matchDependencies(
  manifest: PackageManifest,
  importedPackages: Set<string>,
  packageDir: string,
  options: MatchOptions,
): { unused: UnusedDependency[]; missing: UnusedDependency[] } {
  const declared = buildDeclaredMap(manifest, options);
  const unused: UnusedDependency[] = [];
  const missing: UnusedDependency[] = [];

  // Find declared deps not seen in source imports
  for (const [name, field] of declared) {
    if (!importedPackages.has(name)) {
      unused.push({
        name,
        kind: "declared-not-imported" as UnusedKind,
        declaredIn: field,
      });
    }
  }

  // Find imports not declared in package.json
  for (const importedName of importedPackages) {
    if (!declared.has(importedName)) {
      missing.push({
        name: importedName,
        kind: "imported-not-declared" as UnusedKind,
        importedFrom: packageDir,
      });
    }
  }

  return { unused, missing };
}

/**
 * Build a map of { packageName → fieldName } from package.json.
 * Only includes the fields requested (e.g. skip devDependencies when
 * includeDevDependencies is false).
 */
function buildDeclaredMap(
  manifest: PackageManifest,
  options: MatchOptions,
): Map<string, string> {
  const result = new Map<string, string>();

  const fields: Array<[Record<string, string> | undefined, string]> = [
    [
      manifest.dependencies as Record<string, string> | undefined,
      "dependencies",
    ],
    [
      manifest.optionalDependencies as Record<string, string> | undefined,
      "optionalDependencies",
    ],
  ];

  if (options.includeDevDependencies) {
    fields.push([
      manifest.devDependencies as Record<string, string> | undefined,
      "devDependencies",
    ]);
  }

  // peerDependencies are intentionally excluded — they are rarely directly imported
  // and are a separate concern handled by `rup resolve`.

  for (const [deps, fieldName] of fields) {
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (!result.has(name)) {
        result.set(name, fieldName);
      }
    }
  }

  return result;
}

/**
 * Applies the unused/missing result of `matchDependencies` to a package.json
 * manifest in-memory, removing `unused` entries. Returns the modified manifest
 * as a formatted JSON string ready to write back to disk.
 */
export function removeUnusedFromManifest(
  manifestJson: string,
  unused: UnusedDependency[],
): string {
  if (unused.length === 0) return manifestJson;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(manifestJson) as Record<string, unknown>;
  } catch {
    return manifestJson;
  }

  const unusedNames = new Set(unused.map((u) => u.name));
  const fields = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
  ] as const;

  for (const field of fields) {
    const deps = parsed[field];
    if (!deps || typeof deps !== "object") continue;
    for (const name of Object.keys(deps as Record<string, unknown>)) {
      if (unusedNames.has(name)) {
        delete (deps as Record<string, unknown>)[name];
      }
    }
  }

  return JSON.stringify(parsed, null, 2) + "\n";
}
