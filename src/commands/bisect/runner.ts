import type { BisectOptions, BisectResult } from "../../types/index.js";
import { detectPackageManager, resolvePackageManager } from "../../pm/detect.js";
import { fetchBisectVersions, bisectVersions } from "./engine.js";

/**
 * Entry point for the `bisect` command. Lazy-loaded by cli.ts.
 * Fully isolated: does NOT import anything from core/options.ts.
 */
export async function runBisect(options: BisectOptions): Promise<BisectResult> {
  const detected = await detectPackageManager(options.cwd);
  const runtimeOptions: BisectOptions = {
    ...options,
    testCommand:
      options.testCommand ||
      `${resolvePackageManager("auto", detected, "bun")} test`,
  };

  process.stderr.write(
    `\n[bisect] Fetching available versions for ${runtimeOptions.packageName}...\n`,
  );
  const versions = await fetchBisectVersions(runtimeOptions);

  if (versions.length === 0) {
    throw new Error(
      `No versions found for package "${runtimeOptions.packageName}".`,
    );
  }

  process.stderr.write(
    `[bisect] Found ${versions.length} versions. Starting binary search...\n`,
  );
  if (runtimeOptions.versionRange) {
    process.stderr.write(`[bisect] Range: ${runtimeOptions.versionRange}\n`);
  }

  const result = await bisectVersions(versions, runtimeOptions);

  if (result.breakingVersion) {
    process.stdout.write(
      `\n✖ Break introduced in ${runtimeOptions.packageName}@${result.breakingVersion}\n` +
        `  Last good version: ${result.lastGoodVersion ?? "none"}\n` +
        `  Tested: ${result.totalVersionsTested} versions in ${result.iterations} iterations\n`,
    );
  } else {
    process.stdout.write(
      `\n✔ No breaking version found for ${runtimeOptions.packageName} (all versions passed).\n` +
        `  Tested: ${result.totalVersionsTested} versions\n`,
    );
  }

  return result;
}
