import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

export interface ChangelogEntry {
  content: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

class ChangelogCache {
  private db: any = null;
  private readonly dbPath: string;

  constructor() {
    const basePath = path.join(os.homedir(), ".cache", "rainy-updates");
    this.dbPath = path.join(basePath, "cache.db");
  }

  async init() {
    if (this.db) return;
    try {
      if (typeof Bun !== "undefined") {
        await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
        const mod = await import("bun:sqlite");
        this.db = new mod.Database(this.dbPath, { create: true });
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS changelogs (
            package TEXT PRIMARY KEY,
            content TEXT,
            fetched_at INTEGER NOT NULL
          );
        `);
      }
    } catch (e) {
      // Fail silently if sqlite isn't available
      this.db = null;
    }
  }

  async get(packageName: string): Promise<string | null> {
    if (!this.db) return null;
    try {
      const row = this.db
        .prepare("SELECT content, fetched_at FROM changelogs WHERE package = ?")
        .get(packageName) as
        | { content: string; fetched_at: number }
        | undefined;

      if (!row) return null;

      const isExpired = Date.now() - row.fetched_at > CACHE_TTL_MS;
      if (isExpired) return null;

      return row.content;
    } catch {
      return null;
    }
  }

  async set(packageName: string, content: string): Promise<void> {
    if (!this.db) return;
    try {
      this.db
        .prepare(
          "INSERT OR REPLACE INTO changelogs (package, content, fetched_at) VALUES (?, ?, ?)",
        )
        .run(packageName, content, Date.now());
    } catch {
      // Ignore cache write errors
    }
  }
}

const cache = new ChangelogCache();

/**
 * Parses a repository URL into a GitHub owner and repo.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/);
  if (match && match[1] && match[2]) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

/**
 * Fetches the changelog or release notes for a given package and repository URL.
 * Uses SQLite caching to avoid API rate limits.
 */
export async function fetchChangelog(
  packageName: string,
  repositoryUrl?: string,
): Promise<string | null> {
  if (!repositoryUrl) return null;

  await cache.init();

  // 1. Check Cache
  const cached = await cache.get(packageName);
  if (cached) return cached;

  const githubInfo = parseGitHubUrl(repositoryUrl);
  if (!githubInfo) return null;

  const { owner, repo } = githubInfo;

  try {
    // 2. Fetch from GitHub API
    // Try releases first, fallback to CHANGELOG.md file
    const headers = {
      "User-Agent": "rainy-updates-cli",
      Accept: "application/vnd.github.v3+json",
    };

    let content = "";

    // Attempt to get the latest release notes
    const releasesRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
      { headers },
    );
    if (releasesRes.ok) {
      const release = await releasesRes.json();
      if (release.body) {
        content = `# Release ${release.name || release.tag_name}\n\n${release.body}`;
      }
    }

    if (!content) {
      // Fallback: try to fetch CHANGELOG.md from the root
      const contentsRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/CHANGELOG.md`,
        { headers },
      );
      if (contentsRes.ok) {
        const fileContent = await contentsRes.json();
        if (fileContent.content && fileContent.encoding === "base64") {
          content = Buffer.from(fileContent.content, "base64").toString(
            "utf-8",
          );
        }
      }
    }

    if (content) {
      // 3. Cache the fetched content
      await cache.set(packageName, content);
      return content;
    }

    // Nothing found, cache empty string to prevent spamming
    await cache.set(packageName, "");
    return null;
  } catch (err) {
    return null;
  }
}
