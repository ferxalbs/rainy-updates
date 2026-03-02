import { mkdir } from "node:fs/promises";
import path from "node:path";
import { getRuntimeCwd, readEnv } from "./runtime.js";

function resolveHomeDir(): string {
  return readEnv("HOME") ?? readEnv("USERPROFILE") ?? getRuntimeCwd();
}

export function getHomeDir(): string {
  return resolveHomeDir();
}

export function getCacheDir(appName = "rainy-updates"): string {
  return path.join(readEnv("XDG_CACHE_HOME") ?? path.join(resolveHomeDir(), ".cache"), appName);
}

export function getTempDir(): string {
  return (
    readEnv("BUN_TMPDIR") ??
    readEnv("TMPDIR") ??
    readEnv("TMP") ??
    readEnv("TEMP") ??
    "/tmp"
  );
}

export async function createTempDir(prefix: string): Promise<string> {
  const baseDir = getTempDir();

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = path.join(baseDir, `${prefix}${crypto.randomUUID()}`);
    try {
      await mkdir(candidate, { recursive: false });
      return candidate;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  throw new Error(`Unable to create temp directory for prefix ${prefix}`);
}
