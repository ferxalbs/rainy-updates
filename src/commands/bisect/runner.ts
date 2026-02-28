import type { BisectOptions, BisectResult } from "../../types/index.js";
import { fetchBisectVersions, bisectVersions } from "./engine.js";

/**
 * Entry point for the `bisect` command. Lazy-loaded by cli.ts.
 * Fully isolated: does NOT import anything from core/options.ts.
 */
export async function runBisect(options: BisectOptions): Promise<BisectResult> {
  process.stderr.write(
    `\n[bisect] Fetching available versions for ${options.packageName}...\n`,
  );
  const versions = await fetchBisectVersions(options);

  if (versions.length === 0) {
    throw new Error(`No versions found for package "${options.packageName}".`);
  }

  process.stderr.write(
    `[bisect] Found ${versions.length} versions. Starting binary search...\n`,
  );
  if (options.versionRange) {
    process.stderr.write(`[bisect] Range: ${options.versionRange}\n`);
  }

  const result = await bisectVersions(versions, options);

  if (result.breakingVersion) {
    process.stdout.write(
      `\n✖ Break introduced in ${options.packageName}@${result.breakingVersion}\n` +
        `  Last good version: ${result.lastGoodVersion ?? "none"}\n` +
        `  Tested: ${result.totalVersionsTested} versions in ${result.iterations} iterations\n`,
    );
  } else {
    process.stdout.write(
      `\n✔ No breaking version found for ${options.packageName} (all versions passed).\n` +
        `  Tested: ${result.totalVersionsTested} versions\n`,
    );
  }

  return result;
}
