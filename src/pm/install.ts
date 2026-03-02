import type { DetectedPackageManager, SelectedPackageManager } from "../types/index.js";
import { resolvePackageManager } from "./detect.js";

export async function installDependencies(
  cwd: string,
  packageManager: SelectedPackageManager,
  detected: DetectedPackageManager,
): Promise<void> {
  const command = resolvePackageManager(packageManager, detected);
  const args = ["install"];

  try {
    const proc = Bun.spawn([command, ...args], {
      cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const code = await proc.exited;
    if (code !== 0) {
      throw new Error(
        `${command} ${args.join(" ")} failed with exit code ${code}`,
      );
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}
