import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SnapshotEntry } from "../../types/index.js";

const DEFAULT_STORE_NAME = ".rup-snapshots.json";

/**
 * Lightweight SQLite-free snapshot store (uses a JSON file in the project root).
 *
 * Design goals:
 *   - No extra runtime dependencies (SQLite bindings vary by runtime)
 *   - Human-readable store file (git-committable if desired)
 *   - Atomic writes via tmp-rename to prevent corruption
 *   - Fast: entire store fits in memory for typical use (< 50 snapshots)
 */

export class SnapshotStore {
  private readonly storePath: string;
  private entries: SnapshotEntry[] = [];
  private loaded = false;

  constructor(cwd: string, storeFile?: string) {
    this.storePath = storeFile
      ? path.isAbsolute(storeFile)
        ? storeFile
        : path.join(cwd, storeFile)
      : path.join(cwd, DEFAULT_STORE_NAME);
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        this.entries = parsed as SnapshotEntry[];
      }
    } catch {
      this.entries = [];
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    const tmp = this.storePath + ".tmp";
    await fs.writeFile(
      tmp,
      JSON.stringify(this.entries, null, 2) + "\n",
      "utf8",
    );
    await fs.rename(tmp, this.storePath);
  }

  async saveSnapshot(
    manifests: Record<string, string>,
    lockfileHashes: Record<string, string>,
    label: string,
  ): Promise<SnapshotEntry> {
    await this.load();
    const id = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entry: SnapshotEntry = {
      id,
      label,
      createdAt: Date.now(),
      manifests,
      lockfileHashes,
    };
    this.entries.push(entry);
    await this.save();
    return entry;
  }

  async listSnapshots(): Promise<SnapshotEntry[]> {
    await this.load();
    return [...this.entries].sort((a, b) => b.createdAt - a.createdAt);
  }

  async findSnapshot(idOrLabel: string): Promise<SnapshotEntry | null> {
    await this.load();
    return (
      this.entries.find((e) => e.id === idOrLabel || e.label === idOrLabel) ??
      null
    );
  }

  async deleteSnapshot(idOrLabel: string): Promise<boolean> {
    await this.load();
    const before = this.entries.length;
    this.entries = this.entries.filter(
      (e) => e.id !== idOrLabel && e.label !== idOrLabel,
    );
    if (this.entries.length < before) {
      await this.save();
      return true;
    }
    return false;
  }
}

/** Captures current package.json and lockfile state for a set of directories. */
export async function captureState(
  packageDirs: string[],
): Promise<{
  manifests: Record<string, string>;
  lockfileHashes: Record<string, string>;
}> {
  const manifests: Record<string, string> = {};
  const lockfileHashes: Record<string, string> = {};

  const LOCKFILES = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
  ];

  await Promise.all(
    packageDirs.map(async (dir) => {
      // Read package.json
      try {
        const content = await fs.readFile(
          path.join(dir, "package.json"),
          "utf8",
        );
        manifests[dir] = content;
      } catch {
        // No package.json — skip
      }

      // Hash the first lockfile found
      for (const lf of LOCKFILES) {
        try {
          const content = await fs.readFile(path.join(dir, lf));
          lockfileHashes[dir] = createHash("sha256")
            .update(content)
            .digest("hex");
          break;
        } catch {
          // Try next
        }
      }
    }),
  );

  return { manifests, lockfileHashes };
}

/** Restores package.json files from a snapshot's manifest map. */
export async function restoreState(entry: SnapshotEntry): Promise<void> {
  await Promise.all(
    Object.entries(entry.manifests).map(async ([dir, content]) => {
      const manifestPath = path.join(dir, "package.json");
      const tmp = manifestPath + ".tmp";
      await fs.writeFile(tmp, content, "utf8");
      await fs.rename(tmp, manifestPath);
    }),
  );
}

/** Computes a diff of dependency versions between two manifest snapshots. */
export function diffManifests(
  before: Record<string, string>,
  after: Record<string, string>,
): Array<{ name: string; from: string; to: string }> {
  const changes: Array<{ name: string; from: string; to: string }> = [];

  for (const [dir, afterJson] of Object.entries(after)) {
    const beforeJson = before[dir];
    if (!beforeJson) continue;

    let beforeManifest: Record<string, Record<string, string>>;
    let afterManifest: Record<string, Record<string, string>>;
    try {
      beforeManifest = JSON.parse(beforeJson);
      afterManifest = JSON.parse(afterJson);
    } catch {
      continue;
    }

    const fields = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ] as const;
    for (const field of fields) {
      const before = beforeManifest[field] ?? {};
      const after = afterManifest[field] ?? {};
      const allNames = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const name of allNames) {
        const fromVer = before[name] ?? "(removed)";
        const toVer = after[name] ?? "(removed)";
        if (fromVer !== toVer) {
          changes.push({ name, from: fromVer, to: toVer });
        }
      }
    }
  }

  return changes;
}
