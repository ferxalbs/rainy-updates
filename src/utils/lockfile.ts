import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { LockfileMode } from "../types/index.js";

const LOCKFILE_NAMES = ["package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock"] as const;

export type LockfileSnapshot = Map<string, string | null>;

export async function captureLockfileSnapshot(cwd: string): Promise<LockfileSnapshot> {
  const snapshot: LockfileSnapshot = new Map();
  for (const name of LOCKFILE_NAMES) {
    const filePath = path.join(cwd, name);
    try {
      const content = await fs.readFile(filePath);
      snapshot.set(filePath, hashBuffer(content));
    } catch {
      snapshot.set(filePath, null);
    }
  }
  return snapshot;
}

export async function changedLockfiles(cwd: string, before: LockfileSnapshot): Promise<string[]> {
  const changed: string[] = [];
  for (const name of LOCKFILE_NAMES) {
    const filePath = path.join(cwd, name);
    let current: string | null = null;
    try {
      const content = await fs.readFile(filePath);
      current = hashBuffer(content);
    } catch {
      current = null;
    }
    if ((before.get(filePath) ?? null) !== current) {
      changed.push(filePath);
    }
  }
  return changed.sort((a, b) => a.localeCompare(b));
}

export function validateLockfileMode(mode: LockfileMode, install: boolean): void {
  if (mode === "update" && !install) {
    throw new Error("--lockfile-mode update requires --install to update lockfiles deterministically.");
  }
}

function hashBuffer(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
