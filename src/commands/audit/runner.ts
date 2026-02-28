import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
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
import { extractAuditVersion, fetchAdvisories } from "./fetcher.js";
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

  // Collect all unique package/version targets that can be audited safely.
  const auditTargets = new Map<string, { name: string; version: string }>();
  let skippedRanges = 0;
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
      const version = extractAuditVersion(dep.range);
      if (!version) {
        skippedRanges += 1;
        continue;
      }
      auditTargets.set(`${dep.name}@${version}`, { name: dep.name, version });
    }
  }

  if (skippedRanges > 0) {
    result.warnings.push(
      `Skipped ${skippedRanges} dependency range${skippedRanges === 1 ? "" : "s"} that could not be mapped to a concrete version.`,
    );
  }

  if (auditTargets.size === 0) {
    result.warnings.push("No dependencies found to audit.");
    return result;
  }

  process.stderr.write(
    `[audit] Querying OSV.dev for ${auditTargets.size} dependency version${auditTargets.size === 1 ? "" : "s"}...\n`,
  );
  let advisories = await fetchAdvisories([...auditTargets.values()], {
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

  if (options.fix && result.autoFixable > 0) {
    await applyFix(advisories, options);
  }

  return result;
}

// ─── Fix application ──────────────────────────────────────────────────────────

async function applyFix(
  advisories: CveAdvisory[],
  options: AuditOptions,
): Promise<void> {
  const patchMap = buildPatchMap(advisories);
  if (patchMap.size === 0) return;

  const pm = await detectPackageManager(options.cwd, options.packageManager);
  const installArgs = buildInstallArgs(pm, patchMap);
  const installCmd = `${pm} ${installArgs.join(" ")}`;

  if (options.dryRun) {
    process.stderr.write(
      `[audit] --dry-run: would execute:\n  ${installCmd}\n`,
    );
    if (options.commit) {
      const msg = buildCommitMessage(patchMap);
      process.stderr.write(
        `[audit] --dry-run: would commit:\n  git commit -m "${msg}"\n`,
      );
    }
    return;
  }

  process.stderr.write(`[audit] Applying ${patchMap.size} fix(es)...\n`);
  process.stderr.write(`  → ${installCmd}\n`);

  try {
    await runCommand(pm, installArgs, options.cwd);
  } catch (err) {
    process.stderr.write(`[audit] Install failed: ${String(err)}\n`);
    return;
  }

  process.stderr.write(`[audit] ✔ Patches applied successfully.\n`);

  if (options.commit) {
    await commitFix(patchMap, options.cwd);
  } else {
    process.stderr.write(
      `[audit] Tip: run with --commit to automatically commit the changes.\n`,
    );
  }
}

function buildInstallArgs(pm: string, patchMap: Map<string, string>): string[] {
  const packages = [...patchMap.entries()].map(([n, v]) => `${n}@${v}`);

  switch (pm) {
    case "pnpm":
      return ["add", ...packages];
    case "bun":
      return ["add", ...packages];
    case "yarn":
      return ["add", ...packages];
    default:
      return ["install", ...packages]; // npm
  }
}

async function commitFix(
  patchMap: Map<string, string>,
  cwd: string,
): Promise<void> {
  const msg = buildCommitMessage(patchMap);

  try {
    // Stage all modified files (package.json + lockfiles)
    await runCommand(
      "git",
      [
        "add",
        "package.json",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "bun.lock",
        "bun.lockb",
      ],
      cwd,
      true,
    );
    await runCommand("git", ["commit", "-m", msg], cwd);
    process.stderr.write(`[audit] ✔ Committed: "${msg}"\n`);
  } catch (err) {
    process.stderr.write(`[audit] Git commit failed: ${String(err)}\n`);
    process.stderr.write(
      `[audit] Changes are applied — commit manually with:\n`,
    );
    process.stderr.write(`  git add -A && git commit -m "${msg}"\n`);
  }
}

function buildCommitMessage(patchMap: Map<string, string>): string {
  const items = [...patchMap.entries()];
  if (items.length === 1) {
    const [name, version] = items[0]!;
    return `fix(security): patch ${name} to ${version} (rup audit)`;
  }
  const names = items.map(([n]) => n).join(", ");
  return `fix(security): patch ${items.length} vulnerabilities — ${names} (rup audit)`;
}

/** Detects the package manager in use by checking for lockfiles. */
async function detectPackageManager(
  cwd: string,
  explicit: AuditOptions["packageManager"],
): Promise<string> {
  if (explicit !== "auto") return explicit;

  const checks: Array<[string, string]> = [
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
  ];

  for (const [lockfile, pm] of checks) {
    try {
      await fs.access(path.join(cwd, lockfile));
      return pm;
    } catch {
      // not found, try next
    }
  }

  return "npm"; // default
}

/** Spawns a subprocess, pipes stdio live to the terminal. */
function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  ignoreErrors = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit", // stream stdout/stderr live
      shell: process.platform === "win32",
    });
    child.on("close", (code) => {
      if (code === 0 || ignoreErrors) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}`));
      }
    });
    child.on("error", (err) => {
      if (ignoreErrors) resolve();
      else reject(err);
    });
  });
}
