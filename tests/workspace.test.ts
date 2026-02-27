import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverPackageDirs } from "../src/workspace/discover.js";

test("discoverPackageDirs resolves package.json workspaces", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rainy-updates-workspace-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "root", workspaces: ["packages/*"] }, null, 2),
    "utf8",
  );

  const pkgA = path.join(root, "packages", "a");
  const pkgB = path.join(root, "packages", "b");
  await mkdir(pkgA, { recursive: true });
  await mkdir(pkgB, { recursive: true });
  await writeFile(path.join(pkgA, "package.json"), JSON.stringify({ name: "a" }), "utf8");
  await writeFile(path.join(pkgB, "package.json"), JSON.stringify({ name: "b" }), "utf8");

  const dirs = await discoverPackageDirs(root, true);
  expect(dirs.includes(root)).toBe(true);
  expect(dirs.includes(pkgA)).toBe(true);
  expect(dirs.includes(pkgB)).toBe(true);
});

test("discoverPackageDirs supports recursive and negated patterns", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rainy-updates-workspace-recursive-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "root", workspaces: ["apps/**", "!apps/private/**"] }, null, 2),
    "utf8",
  );

  const appA = path.join(root, "apps", "web");
  const appB = path.join(root, "apps", "private", "internal");
  await mkdir(appA, { recursive: true });
  await mkdir(appB, { recursive: true });
  await writeFile(path.join(appA, "package.json"), JSON.stringify({ name: "web" }), "utf8");
  await writeFile(path.join(appB, "package.json"), JSON.stringify({ name: "internal" }), "utf8");

  const dirs = await discoverPackageDirs(root, true);
  expect(dirs.includes(appA)).toBe(true);
  expect(dirs.includes(appB)).toBe(false);
});
