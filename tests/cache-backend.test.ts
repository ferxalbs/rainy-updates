import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { VersionCache } from "../src/cache/cache.js";

test("VersionCache reports forced file backend fallback reason", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rainy-cache-backend-"));
  process.env.RAINY_UPDATES_CACHE_BACKEND = "file";
  try {
    const cache = await VersionCache.create(root);
    expect(cache.backend).toBe("file");
    expect(cache.degraded).toBe(true);
    expect(cache.fallbackReason).toContain("forced");
  } finally {
    delete process.env.RAINY_UPDATES_CACHE_BACKEND;
  }
});
