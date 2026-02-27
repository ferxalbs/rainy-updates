import { access } from "node:fs/promises";
import path from "node:path";

export async function detectPackageManager(cwd: string): Promise<"npm" | "pnpm" | "unknown"> {
  const pnpmLock = path.join(cwd, "pnpm-lock.yaml");
  const npmLock = path.join(cwd, "package-lock.json");

  try {
    await access(pnpmLock);
    return "pnpm";
  } catch {
    // noop
  }

  try {
    await access(npmLock);
    return "npm";
  } catch {
    return "unknown";
  }
}
