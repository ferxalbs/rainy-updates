import path from "node:path";
import { writeFileAtomic } from "../../utils/io.js";
import type { SnapshotEntry } from "../../types/index.js";

const DEFAULT_STORE_NAME = ".rup-snapshots.json";

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
      const parsed = (await Bun.file(this.storePath).json()) as unknown;
      if (Array.isArray(parsed)) {
        this.entries = parsed as SnapshotEntry[];
      }
    } catch {
      this.entries = [];
    }
    this.loaded = true;
  }

  async save(): Promise<void> {
    await writeFileAtomic(
      this.storePath,
      JSON.stringify(this.entries, null, 2) + "\n",
    );
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

export async function captureState(
  packageDirs: string[],
): Promise<{
  manifests: Record<string, string>;
  lockfileHashes: Record<string, string>;
}> {
  const manifests: Record<string, string> = {};
  const lockfileHashes: Record<string, string> = {};

  const lockfiles = [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
  ];

  await Promise.all(
    packageDirs.map(async (dir) => {
      try {
        manifests[dir] = await Bun.file(path.join(dir, "package.json")).text();
      } catch {
        // No package.json — skip
      }

      for (const lockfileName of lockfiles) {
        const filePath = path.join(dir, lockfileName);
        try {
          const file = Bun.file(filePath);
          if (!(await file.exists())) continue;
          lockfileHashes[dir] = await hashFile(filePath);
          break;
        } catch {
          // Try next
        }
      }
    }),
  );

  return { manifests, lockfileHashes };
}

export async function restoreState(entry: SnapshotEntry): Promise<void> {
  await Promise.all(
    Object.entries(entry.manifests).map(async ([dir, content]) => {
      await writeFileAtomic(path.join(dir, "package.json"), content);
    }),
  );
}

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
      const beforeDeps = beforeManifest[field] ?? {};
      const afterDeps = afterManifest[field] ?? {};
      const allNames = new Set([
        ...Object.keys(beforeDeps),
        ...Object.keys(afterDeps),
      ]);
      for (const name of allNames) {
        const fromVer = beforeDeps[name] ?? "(removed)";
        const toVer = afterDeps[name] ?? "(removed)";
        if (fromVer !== toVer) {
          changes.push({ name, from: fromVer, to: toVer });
        }
      }
    }
  }

  return changes;
}

async function hashFile(filePath: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(await Bun.file(filePath).bytes());
  return hasher.digest("hex");
}
