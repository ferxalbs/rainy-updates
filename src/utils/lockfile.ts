import path from "node:path";
import type { LockfileMode } from "../types/index.js";

const LOCKFILE_NAMES = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
] as const;

export type LockfileSnapshot = Map<string, string | null>;

export async function captureLockfileSnapshot(
  cwd: string,
): Promise<LockfileSnapshot> {
  const snapshot: LockfileSnapshot = new Map();
  for (const name of LOCKFILE_NAMES) {
    const filePath = path.join(cwd, name);
    snapshot.set(filePath, await readLockfileHash(filePath));
  }
  return snapshot;
}

export async function changedLockfiles(
  cwd: string,
  before: LockfileSnapshot,
): Promise<string[]> {
  const changed: string[] = [];
  for (const name of LOCKFILE_NAMES) {
    const filePath = path.join(cwd, name);
    const current = await readLockfileHash(filePath);
    if ((before.get(filePath) ?? null) !== current) {
      changed.push(filePath);
    }
  }
  return changed.sort((a, b) => a.localeCompare(b));
}

export function validateLockfileMode(mode: LockfileMode, install: boolean): void {
  if (mode === "update" && !install) {
    throw new Error(
      "--lockfile-mode update requires --install to update lockfiles deterministically.",
    );
  }
}

async function readLockfileHash(filePath: string): Promise<string | null> {
  try {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;
    const content = await file.bytes();
    return hashBuffer(content);
  } catch {
    return null;
  }
}

function hashBuffer(value: Uint8Array): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(value);
  return hasher.digest("hex");
}
