import {
  collectDependencies,
  readManifest,
} from "../../parsers/package-json.js";
import {
  buildAddInvocation,
  createPackageManagerProfile,
  detectPackageManagerDetails,
} from "../../pm/detect.js";
import { discoverPackageDirs } from "../../workspace/discover.js";
import { writeFileAtomic } from "../../utils/io.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeStderr, writeStdout } from "../../utils/runtime.js";
import type {
  AuditOptions,
  AuditResult,
  CveAdvisory,
} from "../../types/index.js";
import { fetchAdvisories } from "./fetcher.js";
import { resolveAuditTargets } from "./targets.js";
import {
  filterBySeverity,
  buildPatchMap,
  renderAuditSourceHealth,
  renderAuditSummary,
  renderAuditTable,
  summarizeAdvisories,
} from "./mapper.js";
import { formatClassifiedMessage } from "../../core/errors.js";

/**
 * Entry point for `rup audit`. Lazy-loaded by cli.ts.
 * Discovers packages, fetches CVE advisories, filters by severity, and
 * optionally applies minimum-secure-version patches.
 */
export async function runAudit(options: AuditOptions): Promise<AuditResult> {
  const result: AuditResult = {
    advisories: [],
    packages: [],
    autoFixable: 0,
    errors: [],
    warnings: [],
    sourcesUsed: [],
    sourceHealth: [],
    resolution: {
      lockfile: 0,
      manifest: 0,
      unresolved: 0,
    },
  };

  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace, {
    git: options,
    includeKinds: [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ],
    includeDependents: options.affected === true,
  });
  const depsByDir = new Map<string, ReturnType<typeof collectDependencies>>();

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
    depsByDir.set(dir, deps);
  }

  const targetResolution = await resolveAuditTargets(
    options.cwd,
    packageDirs,
    depsByDir,
  );
  result.warnings.push(...targetResolution.warnings);
  result.resolution = targetResolution.resolution;

  if (targetResolution.targets.length === 0) {
    result.warnings.push("No dependencies found to audit.");
    return result;
  }

  if (!options.silent) {
    writeStderr(
      `[audit] Querying ${describeSourceMode(options.sourceMode)} for ${targetResolution.targets.length} dependency version${targetResolution.targets.length === 1 ? "" : "s"}...\n`,
    );
  }
  const fetched = await fetchAdvisories(targetResolution.targets, {
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
    sourceMode: options.sourceMode,
  });
  result.sourcesUsed = fetched.sourcesUsed;
  result.sourceHealth = fetched.sourceHealth;
  result.warnings.push(...fetched.warnings);

  if (fetched.sourceHealth.every((item) => item.status === "failed")) {
    result.errors.push(
      formatClassifiedMessage({
        code: "ADVISORY_SOURCE_DOWN",
        whatFailed: "All advisory sources failed.",
        intact:
          "Dependency target resolution completed, but no advisory coverage was returned.",
        validity: "invalid",
        next: "Retry `rup audit` later or select a single healthy source with --source.",
      }),
    );
  }

  let advisories = fetched.advisories;

  advisories = filterBySeverity(advisories, options.severity);
  result.advisories = advisories;
  result.packages = summarizeAdvisories(advisories);
  result.autoFixable = advisories.filter(
    (a) => a.patchedVersion !== null,
  ).length;

  if (!options.silent) {
    if (options.reportFormat === "summary") {
      writeStdout(
        renderAuditSummary(result.packages) +
          renderAuditSourceHealth(result.sourceHealth) +
          "\n",
      );
    } else if (options.reportFormat === "table" || !options.jsonFile) {
      writeStdout(
        renderAuditTable(advisories) +
          renderAuditSourceHealth(result.sourceHealth) +
          "\n",
      );
    }
  }

  if (options.jsonFile) {
    await writeFileAtomic(
      options.jsonFile,
      stableStringify(
        {
          advisories,
          packages: result.packages,
          sourcesUsed: result.sourcesUsed,
          sourceHealth: result.sourceHealth,
          resolution: result.resolution,
          errors: result.errors,
          warnings: result.warnings,
        },
        2,
      ) + "\n",
    );
    if (!options.silent) {
      writeStderr(
        `[audit] JSON report written to ${options.jsonFile}\n`,
      );
    }
  }

  if (options.fix && result.autoFixable > 0) {
    await applyFix(advisories, options);
  }

  return result;
}

function describeSourceMode(mode: AuditOptions["sourceMode"]): string {
  if (mode === "osv") return "OSV.dev";
  if (mode === "github") return "GitHub Advisory DB";
  return "OSV.dev + GitHub Advisory DB";
}

// ─── Fix application ──────────────────────────────────────────────────────────

async function applyFix(
  advisories: CveAdvisory[],
  options: AuditOptions,
): Promise<void> {
  const patchMap = buildPatchMap(advisories);
  if (patchMap.size === 0) return;

  const detected = await detectPackageManagerDetails(options.cwd);
  const profile = createPackageManagerProfile(
    options.packageManager,
    detected,
  );
  const install = buildInstallArgs(profile, patchMap);
  const installCmd = install.display;

  if (options.dryRun) {
    if (!options.silent) {
      writeStderr(
        `[audit] --dry-run: would execute:\n  ${installCmd}\n`,
      );
      if (options.commit) {
        const msg = buildCommitMessage(patchMap);
        writeStderr(
          `[audit] --dry-run: would commit:\n  git commit -m "${msg}"\n`,
        );
      }
    }
    return;
  }

  if (!options.silent) {
    writeStderr(`[audit] Applying ${patchMap.size} fix(es)...\n`);
    writeStderr(`  → ${installCmd}\n`);
  }

  try {
    await runCommand(install.command, install.args, options.cwd);
  } catch (err) {
    if (!options.silent) {
      writeStderr(`[audit] Install failed: ${String(err)}\n`);
    }
    return;
  }

  if (!options.silent) {
    writeStderr(`[audit] ✔ Patches applied successfully.\n`);
  }

  if (options.commit) {
    await commitFix(patchMap, options.cwd, options.silent);
  } else if (!options.silent) {
    writeStderr(
      `[audit] Tip: run with --commit to automatically commit the changes.\n`,
    );
  }
}

function buildInstallArgs(
  profile: ReturnType<typeof createPackageManagerProfile>,
  patchMap: Map<string, string>,
): ReturnType<typeof buildAddInvocation> {
  const packages = [...patchMap.entries()].map(([n, v]) => `${n}@${v}`);
  return buildAddInvocation(profile, packages);
}

async function commitFix(
  patchMap: Map<string, string>,
  cwd: string,
  silent?: boolean,
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
    if (!silent) process.stderr.write(`[audit] ✔ Committed: "${msg}"\n`);
  } catch (err) {
    if (!silent) {
      process.stderr.write(`[audit] Git commit failed: ${String(err)}\n`);
      process.stderr.write(
        `[audit] Changes are applied — commit manually with:\n`,
      );
      process.stderr.write(`  git add -A && git commit -m "${msg}"\n`);
    }
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

/** Spawns a subprocess, pipes stdio live to the terminal. */
function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  ignoreErrors = false,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const proc = Bun.spawn([cmd, ...args], {
        cwd,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      const code = await proc.exited;
      if (code === 0 || ignoreErrors) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}`));
      }
    } catch (err) {
      if (ignoreErrors) resolve();
      else reject(err);
    }
  });
}
