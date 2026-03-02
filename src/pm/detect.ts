import path from "node:path";
import type {
  DetectedPackageManager,
  SelectedPackageManager,
  SupportedPackageManager,
} from "../types/index.js";

const PACKAGE_MANAGER_LOCKFILES: Array<[string, SupportedPackageManager]> = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
  ["yarn.lock", "yarn"],
];

export async function detectPackageManager(
  cwd: string,
): Promise<DetectedPackageManager> {
  for (const [lockfile, packageManager] of PACKAGE_MANAGER_LOCKFILES) {
    if (await fileExists(path.join(cwd, lockfile))) {
      return packageManager;
    }
  }

  return "unknown";
}

export function resolvePackageManager(
  requested: SelectedPackageManager,
  detected: DetectedPackageManager,
  fallback: SupportedPackageManager = "npm",
): SupportedPackageManager {
  if (requested !== "auto") return requested;
  if (detected !== "unknown") return detected;
  return fallback;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await Bun.file(filePath).exists();
  } catch {
    return false;
  }
}
