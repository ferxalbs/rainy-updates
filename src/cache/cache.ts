import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
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
    return entries[key] ?? null;
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
        fetched_at INTEGER NOT NULL,
        ttl_seconds INTEGER NOT NULL,
        PRIMARY KEY (package_name, target)
      );
    `);
  }

  async get(packageName: string, target: TargetLevel): Promise<CachedVersion | null> {
    const row = this.db
      .prepare(
        `SELECT package_name, target, latest_version, fetched_at, ttl_seconds FROM versions WHERE package_name = ? AND target = ?`,
      )
      .get(packageName, target);

    if (!row) return null;

    return {
      packageName: row.package_name,
      target: row.target,
      latestVersion: row.latest_version,
      fetchedAt: row.fetched_at,
      ttlSeconds: row.ttl_seconds,
    };
  }

  async set(entry: CachedVersion): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO versions (package_name, target, latest_version, fetched_at, ttl_seconds)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(entry.packageName, entry.target, entry.latestVersion, entry.fetchedAt, entry.ttlSeconds);
  }
}

export class VersionCache {
  private readonly store: CacheStore;

  private constructor(store: CacheStore) {
    this.store = store;
  }

  static async create(customPath?: string): Promise<VersionCache> {
    const basePath = customPath ?? path.join(os.homedir(), ".cache", "rainy-updates");
    const sqlitePath = path.join(basePath, "cache.db");

    const sqliteStore = await tryCreateSqliteStore(sqlitePath);
    if (sqliteStore) return new VersionCache(sqliteStore);

    const jsonPath = path.join(basePath, "cache.json");
    return new VersionCache(new FileCacheStore(jsonPath));
  }

  async getValid(packageName: string, target: TargetLevel): Promise<CachedVersion | null> {
    const entry = await this.store.get(packageName, target);
    if (!entry) return null;
    const expiresAt = entry.fetchedAt + entry.ttlSeconds * 1000;
    if (Date.now() > expiresAt) return null;
    return entry;
  }

  async set(packageName: string, target: TargetLevel, latestVersion: string, ttlSeconds: number): Promise<void> {
    await this.store.set({
      packageName,
      target,
      latestVersion,
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
    // noop
  }

  try {
    const maybeRequire = Function("return require")() as (id: string) => any;
    const Database = maybeRequire("better-sqlite3");
    const db = new Database(dbPath);
    return new SqliteCacheStore(db);
  } catch {
    return null;
  }
}
