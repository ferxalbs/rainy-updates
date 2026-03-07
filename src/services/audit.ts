import {
  collectDependencies,
  readManifest,
} from "../parsers/package-json.js";
import { discoverPackageDirs } from "../workspace/discover.js";
import type {
  AuditOptions,
  AuditResult,
  CveAdvisory,
  ServiceContext,
} from "../types/index.js";
import { fetchAdvisories } from "../commands/audit/fetcher.js";
import { resolveAuditTargets } from "../commands/audit/targets.js";
import {
  filterBySeverity,
  summarizeAdvisories,
  buildPatchMap,
} from "../commands/audit/mapper.js";
import { formatClassifiedMessage } from "../core/errors.js";
import {
  buildAddInvocation,
  createPackageManagerProfile,
  detectPackageManagerDetails,
} from "../pm/detect.js";
import { emitServiceEvent } from "./context.js";

export async function runAuditService(
  options: AuditOptions,
  context?: ServiceContext,
): Promise<AuditResult> {
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
    try {
      const manifest = await readManifest(dir);
      depsByDir.set(
        dir,
        collectDependencies(manifest, [
          "dependencies",
          "devDependencies",
          "optionalDependencies",
        ]),
      );
    } catch (error) {
      result.errors.push(`Failed to read package.json in ${dir}: ${String(error)}`);
    }
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

  emitServiceEvent(context, {
    level: "info",
    message: `[audit] Querying advisories for ${targetResolution.targets.length} dependency versions`,
  });

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

  const advisories = filterBySeverity(fetched.advisories, options.severity);
  result.advisories = advisories;
  result.packages = summarizeAdvisories(advisories);
  result.autoFixable = advisories.filter((a) => a.patchedVersion !== null).length;

  if (options.fix && result.autoFixable > 0) {
    await applyAuditFix(advisories, options, context);
  }

  return result;
}

async function applyAuditFix(
  advisories: CveAdvisory[],
  options: AuditOptions,
  context?: ServiceContext,
): Promise<void> {
  const patchMap = buildPatchMap(advisories);
  if (patchMap.size === 0) return;

  const detected = await detectPackageManagerDetails(options.cwd);
  const profile = createPackageManagerProfile(options.packageManager, detected);
  const packages = [...patchMap.entries()].map(([name, version]) => `${name}@${version}`);
  const install = buildAddInvocation(profile, packages);

  emitServiceEvent(context, {
    level: "info",
    message: options.dryRun
      ? `[audit] --dry-run would execute: ${install.display}`
      : `[audit] Applying ${patchMap.size} security fix(es)`,
  });

  if (options.dryRun) return;

  const proc = Bun.spawn({
    cmd: [install.command, ...install.args],
    cwd: options.cwd,
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Audit fix install failed with exit code ${exitCode}`);
  }
}
