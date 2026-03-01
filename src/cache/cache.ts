import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import type { CachedVersion, TargetLevel } from "../types/index.js";

interface CacheStore {
  get(packageName: string, target: TargetLevel): Promise<CachedVersion | null>;
  set(entry: CachedVersion): Promise<void>;
}

class FileCacheStore implements CacheStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async get(packageName: string, target: TargetLevel): Promise<CachedVersion | null> {
    const entries = await this.readEntries();
    const key = this.getKey(packageName, target);
    const entry = entries[key];
    if (!entry) return null;
    return {
      ...entry,
      availableVersions: Array.isArray(entry.availableVersions) ? entry.availableVersions : [entry.latestVersion],
    };
  }

  async set(entry: CachedVersion): Promise<void> {
    const entries = await this.readEntries();
    entries[this.getKey(entry.packageName, entry.target)] = entry;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(entries), "utf8");
  }

  private async readEntries(): Promise<Record<string, CachedVersion>> {
    try {
      const content = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(content) as Record<string, CachedVersion>;
    } catch {
      return {};
    }
  }

  private getKey(packageName: string, target: TargetLevel): string {
    return `${packageName}:${target}`;
  }
}

class SqliteCacheStore implements CacheStore {
  private db: any;

  constructor(db: any) {
    this.db = db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS versions (
        package_name TEXT NOT NULL,
        target TEXT NOT NULL,
        latest_version TEXT NOT NULL,
        available_versions TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        ttl_seconds INTEGER NOT NULL,
        PRIMARY KEY (package_name, target)
      );
    `);
    this.ensureSchema();
  }

  async get(packageName: string, target: TargetLevel): Promise<CachedVersion | null> {
    let row: any;
    try {
      row = this.db
        .prepare(
          `SELECT package_name, target, latest_version, available_versions, fetched_at, ttl_seconds FROM versions WHERE package_name = ? AND target = ?`,
        )
        .get(packageName, target);
    } catch {
      row = this.db
        .prepare(
          `SELECT package_name, target, latest_version, fetched_at, ttl_seconds FROM versions WHERE package_name = ? AND target = ?`,
        )
        .get(packageName, target);
    }

    if (!row) return null;

    return {
      packageName: row.package_name,
      target: row.target,
      latestVersion: row.latest_version,
      availableVersions: parseJsonArray(row.available_versions ?? row.latest_version, row.latest_version),
      fetchedAt: row.fetched_at,
      ttlSeconds: row.ttl_seconds,
    };
  }

  async set(entry: CachedVersion): Promise<void> {
    try {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO versions (package_name, target, latest_version, available_versions, fetched_at, ttl_seconds)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          entry.packageName,
          entry.target,
          entry.latestVersion,
          JSON.stringify(entry.availableVersions),
          entry.fetchedAt,
          entry.ttlSeconds,
        );
    } catch {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO versions (package_name, target, latest_version, fetched_at, ttl_seconds)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(entry.packageName, entry.target, entry.latestVersion, entry.fetchedAt, entry.ttlSeconds);
    }
  }

  private ensureSchema(): void {
    try {
      const columns = this.db.prepare("PRAGMA table_info(versions);").all() as Array<{ name?: string }>;
      const hasAvailableVersions = columns.some((column) => column.name === "available_versions");
      if (!hasAvailableVersions) {
        this.db.exec("ALTER TABLE versions ADD COLUMN available_versions TEXT;");
      }
      this.db.exec("UPDATE versions SET available_versions = latest_version WHERE available_versions IS NULL;");
    } catch {
      // Best-effort migration.
    }
  }
}

export class VersionCache {
  private readonly store: CacheStore;
  readonly backend: "sqlite" | "file";
  readonly degraded: boolean;
  readonly fallbackReason?: string;

  private constructor(
    store: CacheStore,
    backend: "sqlite" | "file",
    degraded: boolean,
    fallbackReason?: string,
  ) {
    this.store = store;
    this.backend = backend;
    this.degraded = degraded;
    this.fallbackReason = fallbackReason;
  }

  static async create(customPath?: string): Promise<VersionCache> {
    const basePath = customPath ?? path.join(os.homedir(), ".cache", "rainy-updates");
    if (process.env.RAINY_UPDATES_CACHE_BACKEND === "file") {
      const jsonPath = path.join(basePath, "cache.json");
      return new VersionCache(
        new FileCacheStore(jsonPath),
        "file",
        true,
        "forced via RAINY_UPDATES_CACHE_BACKEND=file",
      );
    }
    const sqlitePath = path.join(basePath, "cache.db");

    const sqliteStore = await tryCreateSqliteStore(sqlitePath);
    if (sqliteStore) return new VersionCache(sqliteStore, "sqlite", false);

    const jsonPath = path.join(basePath, "cache.json");
    const degraded = typeof Bun !== "undefined";
    return new VersionCache(
      new FileCacheStore(jsonPath),
      "file",
      degraded,
      degraded ? "bun:sqlite unavailable; using file cache backend" : undefined,
    );
  }

  async getValid(packageName: string, target: TargetLevel): Promise<CachedVersion | null> {
    const entry = await this.store.get(packageName, target);
    if (!entry) return null;
    const expiresAt = entry.fetchedAt + entry.ttlSeconds * 1000;
    if (Date.now() > expiresAt) return null;
    return entry;
  }

  async getAny(packageName: string, target: TargetLevel): Promise<CachedVersion | null> {
    return this.store.get(packageName, target);
  }

  async set(
    packageName: string,
    target: TargetLevel,
    latestVersion: string,
    availableVersions: string[],
    ttlSeconds: number,
  ): Promise<void> {
    await this.store.set({
      packageName,
      target,
      latestVersion,
      availableVersions,
      fetchedAt: Date.now(),
      ttlSeconds,
    });
  }
}

async function tryCreateSqliteStore(dbPath: string): Promise<SqliteCacheStore | null> {
  try {
    if (typeof Bun !== "undefined") {
      const mod = await import("bun:sqlite");
      const db = new mod.Database(dbPath, { create: true });
      return new SqliteCacheStore(db);
    }
  } catch {
    return null;
  }

  return null;
}

function parseJsonArray(raw: unknown, fallback: string): string[] {
  if (typeof raw !== "string") return [fallback];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [fallback];
    const values = parsed.filter((value): value is string => typeof value === "string");
    return values.length > 0 ? values : [fallback];
  } catch {
    return [fallback];
  }
}
