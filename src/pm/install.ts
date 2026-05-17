import type { DetectedPackageManager, SelectedPackageManager } from "../types/index.js";
import {
  buildInstallInvocation,
  createPackageManagerProfile,
  type PackageManagerDetection,
} from "./detect.js";

export async function installDependencies(
  cwd: string,
  packageManager: SelectedPackageManager,
  detected: DetectedPackageManager | PackageManagerDetection,
): Promise<void> {
  const detection =
    typeof detected === "string"
      ? { manager: detected, source: "fallback" as const }
      : detected;
  const invocation = buildInstallInvocation(
    createPackageManagerProfile(packageManager, detection),
  );

  try {
    if (typeof Bun !== "undefined") {
      const { exitCode } = await Bun.$`${invocation.command} ${invocation.args}`
        .cwd(cwd)
        .nothrow();

      if (exitCode !== 0) {
        throw new Error(`${invocation.display} failed with exit code ${exitCode}`);
      }
    } else {
      const { spawnSync } = await import("node:child_process");
      const result = spawnSync(invocation.command, invocation.args, {
        cwd,
        shell: true,
        stdio: "inherit",
      });
      if (result.status !== 0) {
        throw new Error(`${invocation.display} failed with exit code ${result.status}`);
      }
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}
