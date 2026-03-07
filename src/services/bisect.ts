import type { BisectOptions, BisectResult, ServiceContext } from "../types/index.js";
import {
  buildTestCommand,
  createPackageManagerProfile,
  detectPackageManagerDetails,
} from "../pm/detect.js";
import { fetchBisectVersions, bisectVersions } from "../commands/bisect/engine.js";
import { emitServiceEvent } from "./context.js";

export async function runBisectService(
  options: BisectOptions,
  context?: ServiceContext,
): Promise<BisectResult> {
  const detected = await detectPackageManagerDetails(options.cwd);
  const profile = createPackageManagerProfile("auto", detected, "bun");
  const runtimeOptions: BisectOptions = {
    ...options,
    testCommand: options.testCommand || buildTestCommand(profile),
  };

  emitServiceEvent(context, {
    level: "info",
    message: `[bisect] Fetching available versions for ${runtimeOptions.packageName}`,
  });

  const versions = await fetchBisectVersions(runtimeOptions);
  if (versions.length === 0) {
    throw new Error(`No versions found for package "${runtimeOptions.packageName}".`);
  }

  emitServiceEvent(context, {
    level: "info",
    message: `[bisect] Found ${versions.length} versions; starting binary search`,
  });

  return bisectVersions(versions, runtimeOptions);
}

export function renderBisectResult(result: BisectResult): string {
  if (result.breakingVersion) {
    return (
      `\n✖ Break introduced in ${result.packageName}@${result.breakingVersion}\n` +
      `  Last good version: ${result.lastGoodVersion ?? "none"}\n` +
      `  Tested: ${result.totalVersionsTested} versions in ${result.iterations} iterations\n`
    );
  }

  return (
    `\n✔ No breaking version found for ${result.packageName} (all versions passed).\n` +
    `  Tested: ${result.totalVersionsTested} versions\n`
  );
}
