import type { DependencyKind, PackageManifest, UpgradeOptions, UpgradeResult } from "../types/index.js";
import { check } from "./check.js";
import { readManifest, writeManifest } from "../parsers/package-json.js";
import { installDependencies } from "../pm/install.js";
import { detectPackageManager } from "../pm/detect.js";
import { applyRangeStyle, parseVersion, compareVersions } from "../utils/semver.js";
import { buildWorkspaceGraph } from "../workspace/graph.js";
import { captureLockfileSnapshot, changedLockfiles, validateLockfileMode } from "../utils/lockfile.js";
import { createSummary, finalizeSummary } from "./summary.js";
import { readDecisionPlan, selectedUpdatesFromPlan } from "./decision-plan.js";
import { runVerification } from "./verification.js";

export async function upgrade(options: UpgradeOptions): Promise<UpgradeResult> {
  validateLockfileMode(options.lockfileMode, options.install);
  const lockfilesBefore = await captureLockfileSnapshot(options.cwd);
  const checkResult = options.fromPlanFile
    ? await createUpgradeResultFromPlan(options)
    : await check(options);
  if (checkResult.updates.length === 0) {
    return {
      ...checkResult,
      changed: false,
    };
  }

  const selectedUpdates = options.fromPlanFile
    ? checkResult.updates
    : checkResult.updates;
  await applySelectedUpdates(options, selectedUpdates);

  const lockfileChanges = await changedLockfiles(options.cwd, lockfilesBefore);
  if (lockfileChanges.length > 0 && (options.lockfileMode === "preserve" || options.lockfileMode === "error")) {
    throw new Error(`Lockfile changes detected in ${options.lockfileMode} mode: ${lockfileChanges.join(", ")}`);
  }
  if (lockfileChanges.length > 0 && options.lockfileMode === "update") {
    checkResult.warnings.push(`Lockfiles changed: ${lockfileChanges.map((item) => item.split("/").pop()).join(", ")}`);
  }

  if (options.verify !== "none") {
    const verification = await runVerification(options);
    checkResult.summary.verificationState = verification.passed
      ? "passed"
      : "failed";
    checkResult.summary.verificationFailures = verification.checks.filter(
      (check) => !check.passed,
    ).length;
    if (!verification.passed) {
      checkResult.errors.push(
        ...verification.checks
          .filter((check) => !check.passed)
          .map(
            (check) =>
              `Verification failed for ${check.name}: ${check.error ?? check.command}`,
          ),
      );
    }
  }

  return {
    ...checkResult,
    changed: true,
    summary: {
      ...checkResult.summary,
      upgraded: checkResult.updates.length,
    },
  };
}

export async function applySelectedUpdates(
  options: UpgradeOptions,
  updates: UpgradeResult["updates"],
): Promise<void> {
  validateLockfileMode(options.lockfileMode, options.install);
  if (updates.length === 0) {
    return;
  }

  const manifestsByPath = new Map<string, PackageManifest>();

  for (const update of updates) {
    const manifestPath = update.packagePath;
    let manifest = manifestsByPath.get(manifestPath);
    if (!manifest) {
      manifest = await readManifest(manifestPath);
      manifestsByPath.set(manifestPath, manifest);
    }

    applyDependencyVersion(manifest, update.kind, update.name, update.toRange);
  }

  if (options.sync) {
    const graph = buildWorkspaceGraph(manifestsByPath, options.includeKinds);
    applyWorkspaceSync(
      manifestsByPath,
      graph.orderedPaths,
      graph.localPackageNames,
      options.includeKinds,
      updates,
    );
  }

  for (const [manifestPath, manifest] of manifestsByPath) {
    await writeManifest(manifestPath, manifest);
  }

  if (options.install) {
    const detected = await detectPackageManager(options.cwd);
    await installDependencies(options.cwd, options.packageManager, detected);
  }
}

async function createUpgradeResultFromPlan(
  options: UpgradeOptions,
): Promise<UpgradeResult> {
  if (!options.fromPlanFile) {
    throw new Error("Missing decision plan file.");
  }
  const plan = await readDecisionPlan(options.fromPlanFile);
  const packageManager = await detectPackageManager(options.cwd);
  const updates = selectedUpdatesFromPlan(plan);
  const packagePaths = Array.from(
    new Set(updates.map((update) => update.packagePath)),
  ).sort((left, right) => left.localeCompare(right));
  const summary = finalizeSummary(
    createSummary({
      scannedPackages: packagePaths.length,
      totalDependencies: updates.length,
      checkedDependencies: updates.length,
      updatesFound: updates.length,
      upgraded: 0,
      skipped: 0,
      warmedPackages: 0,
      errors: [],
      warnings: [],
      durations: {
        totalMs: 0,
        discoveryMs: 0,
        registryMs: 0,
        cacheMs: 0,
      },
    }),
  );
  summary.decisionPlan = options.fromPlanFile;
  summary.interactiveSurface = plan.interactiveSurface;
  summary.queueFocus = plan.focus;
  summary.updatesFound = updates.length;

  return {
    projectPath: options.cwd,
    packagePaths,
    packageManager,
    target: plan.target,
    timestamp: new Date().toISOString(),
    summary,
    updates,
    errors: [],
    warnings: [],
    changed: false,
  };
}

function applyWorkspaceSync(
  manifestsByPath: Map<string, PackageManifest>,
  orderedPaths: string[],
  localPackageNames: Set<string>,
  includeKinds: DependencyKind[],
  updates: UpgradeResult["updates"],
): void {
  const desiredByPackage = new Map<string, string>();

  for (const update of updates) {
    const current = desiredByPackage.get(update.name);
    if (!current) {
      desiredByPackage.set(update.name, update.toVersionResolved);
      continue;
    }

    const currentParsed = parseVersion(current);
    const nextParsed = parseVersion(update.toVersionResolved);
    if (!currentParsed || !nextParsed) {
      desiredByPackage.set(update.name, update.toVersionResolved);
      continue;
    }

    if (compareVersions(nextParsed, currentParsed) > 0) {
      desiredByPackage.set(update.name, update.toVersionResolved);
    }
  }

  for (const manifestPath of orderedPaths) {
    const manifest = manifestsByPath.get(manifestPath);
    if (!manifest) continue;

    for (const kind of includeKinds) {
      const section = manifest[kind] as Record<string, string> | undefined;
      if (!section) continue;

      for (const [depName, depRange] of Object.entries(section)) {
        const desiredVersion = desiredByPackage.get(depName);
        if (!desiredVersion) continue;
        if (localPackageNames.has(depName) && depRange.startsWith("workspace:")) continue;
        section[depName] = applyRangeStyle(depRange, desiredVersion);
      }
    }
  }
}

function applyDependencyVersion(
  manifest: PackageManifest,
  kind: DependencyKind,
  depName: string,
  nextRange: string,
): void {
  const section = manifest[kind] as Record<string, string> | undefined;
  if (!section || !section[depName]) return;
  section[depName] = nextRange;
}
