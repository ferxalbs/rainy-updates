import process from "node:process";
import type {
  LicenseOptions,
  LicenseResult,
  PackageLicense,
} from "../../types/index.js";
import { discoverPackageDirs } from "../../workspace/discover.js";
import {
  readManifest,
  collectDependencies,
} from "../../parsers/package-json.js";
import { asyncPool } from "../../utils/async-pool.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { generateSbom } from "./sbom.js";

/**
 * Entry point for `rup licenses`. Lazy-loaded by cli.ts.
 *
 * Fetches the SPDX license field from each dependency's packument,
 * checks it against --allow/--deny lists, and optionally generates
 * an SPDX 2.3 SBOM JSON document.
 */
export async function runLicenses(
  options: LicenseOptions,
): Promise<LicenseResult> {
  const result: LicenseResult = {
    packages: [],
    violations: [],
    totalViolations: 0,
    errors: [],
    warnings: [],
  };

  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace);
  const allDeps = new Map<string, string>(); // name → resolved version

  for (const packageDir of packageDirs) {
    let manifest;
    try {
      manifest = await readManifest(packageDir);
    } catch (err) {
      result.errors.push(`${packageDir}: ${String(err)}`);
      continue;
    }

    const deps = collectDependencies(manifest, [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ]);
    for (const dep of deps) {
      if (!allDeps.has(dep.name)) {
        const bare =
          dep.range.replace(/^[~^>=<]/, "").split(" ")[0] ?? dep.range;
        allDeps.set(dep.name, bare);
      }
    }
  }

  // Fetch license info from npm registry in parallel
  const names = Array.from(allDeps.keys());
  const fetchTasks: Array<() => Promise<PackageLicense | null>> = names.map(
    (name) => async () => {
      const version = allDeps.get(name) ?? "latest";
      return fetchLicenseInfo(name, version, options.registryTimeoutMs);
    },
  );

  const licenseInfos = await asyncPool<PackageLicense | null>(
    options.concurrency,
    fetchTasks,
  );

  for (const info of licenseInfos) {
    if (!info || info instanceof Error) continue;
    result.packages.push(info);
  }

  // Evaluate allow/deny lists
  for (const pkg of result.packages) {
    if (isViolation(pkg, options)) {
      result.violations.push(pkg);
    }
  }
  result.totalViolations = result.violations.length;

  // Render
  process.stdout.write(renderLicenseTable(result) + "\n");

  // SBOM output
  if (options.sbomFile) {
    const sbom = generateSbom(result.packages, options.cwd);
    await writeFileAtomic(options.sbomFile, stableStringify(sbom, 2) + "\n");
    process.stderr.write(`[licenses] SBOM written to ${options.sbomFile}\n`);
  }

  // JSON output
  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
    process.stderr.write(
      `[licenses] JSON report written to ${options.jsonFile}\n`,
    );
  }

  return result;
}

async function fetchLicenseInfo(
  name: string,
  version: string,
  timeoutMs: number,
): Promise<PackageLicense | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      license?: string;
      homepage?: string;
      repository?: { url?: string } | string;
    };

    const rawLicense = data.license ?? "UNKNOWN";
    const repo =
      typeof data.repository === "object"
        ? data.repository?.url
        : data.repository;

    return {
      name,
      version,
      license: rawLicense,
      spdxExpression: normalizeSpdx(rawLicense),
      homepage: data.homepage,
      repository: repo,
    };
  } catch {
    return null;
  }
}

/** Normalizes common license strings to SPDX identifiers. */
function normalizeSpdx(raw: string): string | null {
  const known: Record<string, string> = {
    MIT: "MIT",
    ISC: "ISC",
    "Apache-2.0": "Apache-2.0",
    "BSD-2-Clause": "BSD-2-Clause",
    "BSD-3-Clause": "BSD-3-Clause",
    "GPL-3.0": "GPL-3.0",
    "GPL-2.0": "GPL-2.0",
    "LGPL-2.1": "LGPL-2.1",
    "LGPL-3.0": "LGPL-3.0",
    "MPL-2.0": "MPL-2.0",
    "CC0-1.0": "CC0-1.0",
    Unlicense: "Unlicense",
    "AGPL-3.0": "AGPL-3.0",
  };
  return known[raw.trim()] ?? (raw.includes("-") ? raw : null);
}

function isViolation(pkg: PackageLicense, options: LicenseOptions): boolean {
  const spdx = pkg.spdxExpression ?? pkg.license;
  if (options.deny && options.deny.includes(spdx)) return true;
  if (
    options.allow &&
    options.allow.length > 0 &&
    !options.allow.includes(spdx)
  )
    return true;
  return false;
}

function renderLicenseTable(result: LicenseResult): string {
  const lines: string[] = [];

  if (result.violations.length > 0) {
    lines.push(`\n✖ License violations (${result.violations.length}):\n`);
    for (const pkg of result.violations) {
      lines.push(
        `  \x1b[31m✖\x1b[0m ${pkg.name.padEnd(35)} ${pkg.spdxExpression ?? pkg.license}`,
      );
    }
    lines.push("");
  }

  lines.push(`📄 ${result.packages.length} packages scanned:\n`);
  lines.push("  " + "Package".padEnd(35) + "Version".padEnd(12) + "License");
  lines.push("  " + "─".repeat(60));

  for (const pkg of result.packages) {
    const isViolating = result.violations.some((v) => v.name === pkg.name);
    const prefix = isViolating ? "\x1b[31m" : "";
    const suffix = isViolating ? "\x1b[0m" : "";
    lines.push(
      "  " +
        prefix +
        pkg.name.padEnd(35) +
        pkg.version.padEnd(12) +
        (pkg.spdxExpression ?? pkg.license) +
        suffix,
    );
  }

  return lines.join("\n");
}
