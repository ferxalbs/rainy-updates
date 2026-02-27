import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { check } from "../src/core/check.js";

test("offline mode reports cache miss error", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-offline-"));
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({
      name: "offline-test",
      dependencies: {
        react: "^18.2.0",
      },
    }),
    "utf8",
  );

  const result = await check({
    cwd: dir,
    target: "latest",
    filter: undefined,
    reject: undefined,
    cacheTtlSeconds: 60,
    includeKinds: ["dependencies"],
    ci: false,
    format: "json",
    workspace: false,
    jsonFile: undefined,
    githubOutputFile: undefined,
    sarifFile: undefined,
    concurrency: 2,
    offline: true,
  });

  expect(result.errors.some((item) => item.includes("Offline cache miss for react"))).toBe(true);
});
