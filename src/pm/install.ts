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
    const proc = Bun.spawn([invocation.command, ...invocation.args], {
      cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const code = await proc.exited;
    if (code !== 0) {
      throw new Error(
        `${invocation.display} failed with exit code ${code}`,
      );
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}
