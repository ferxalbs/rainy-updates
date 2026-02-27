import type { DependencyKind, PackageManifest, UpgradeOptions, UpgradeResult } from "../types/index.js";
import { check } from "./check.js";
import { readManifest, writeManifest } from "../parsers/package-json.js";
import { installDependencies } from "../pm/install.js";
import { applyRangeStyle, parseVersion, compareVersions } from "../utils/semver.js";
import { buildWorkspaceGraph } from "../workspace/graph.js";

export async function upgrade(options: UpgradeOptions): Promise<UpgradeResult> {
  const checkResult = await check(options);
  if (checkResult.updates.length === 0) {
    return {
      ...checkResult,
      changed: false,
    };
  }

  const manifestsByPath = new Map<string, PackageManifest>();

  for (const update of checkResult.updates) {
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
    if (graph.cycles.length > 0) {
      checkResult.warnings.push(
        `Workspace graph contains cycle(s): ${graph.cycles.map((cycle) => cycle.join(" -> ")).join(" | ")}`,
      );
    }
    applyWorkspaceSync(manifestsByPath, graph.orderedPaths, graph.localPackageNames, options.includeKinds, checkResult.updates);
  }

  for (const [manifestPath, manifest] of manifestsByPath) {
    await writeManifest(manifestPath, manifest);
  }

  if (options.install) {
    await installDependencies(options.cwd, options.packageManager, checkResult.packageManager);
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
