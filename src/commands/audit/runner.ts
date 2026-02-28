import {
  collectDependencies,
  readManifest,
} from "../../parsers/package-json.js";
import { discoverPackageDirs } from "../../workspace/discover.js";
import { writeFileAtomic } from "../../utils/io.js";
import { stableStringify } from "../../utils/stable-json.js";
import type {
  AuditOptions,
  AuditResult,
  CveAdvisory,
} from "../../types/index.js";
import { fetchAdvisories } from "./fetcher.js";
import { filterBySeverity, buildPatchMap, renderAuditTable } from "./mapper.js";

/**
 * Entry point for `rup audit`. Lazy-loaded by cli.ts.
 * Discovers packages, fetches CVE advisories, filters by severity, and
 * optionally applies minimum-secure-version patches.
 */
export async function runAudit(options: AuditOptions): Promise<AuditResult> {
  const result: AuditResult = {
    advisories: [],
    autoFixable: 0,
    errors: [],
    warnings: [],
  };

  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace);

  // Collect all unique package names
  const packageNames = new Set<string>();
  for (const dir of packageDirs) {
    let manifest;
    try {
      manifest = await readManifest(dir);
    } catch (error) {
      result.errors.push(
        `Failed to read package.json in ${dir}: ${String(error)}`,
      );
      continue;
    }
    const deps = collectDependencies(manifest, [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ]);
    for (const dep of deps) {
      packageNames.add(dep.name);
    }
  }

  if (packageNames.size === 0) {
    result.warnings.push("No dependencies found to audit.");
    return result;
  }

  process.stderr.write(
    `[audit] Querying OSV.dev for ${packageNames.size} packages...\n`,
  );
  let advisories = await fetchAdvisories([...packageNames], {
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
  });

  advisories = filterBySeverity(advisories, options.severity);
  result.advisories = advisories;
  result.autoFixable = advisories.filter(
    (a) => a.patchedVersion !== null,
  ).length;

  if (options.reportFormat === "table" || !options.jsonFile) {
    process.stdout.write(renderAuditTable(advisories) + "\n");
  }

  if (options.jsonFile) {
    await writeFileAtomic(
      options.jsonFile,
      stableStringify(
        { advisories, errors: result.errors, warnings: result.warnings },
        2,
      ) + "\n",
    );
    process.stderr.write(
      `[audit] JSON report written to ${options.jsonFile}\n`,
    );
  }

  if (options.fix && !options.dryRun && result.autoFixable > 0) {
    const patchMap = buildPatchMap(advisories);
    process.stderr.write(
      `[audit] --fix: ${patchMap.size} packages have available patches. Apply with: npm install ${[...patchMap.entries()].map(([n, v]) => `${n}@${v}`).join(" ")}\n`,
    );
  }

  return result;
}
