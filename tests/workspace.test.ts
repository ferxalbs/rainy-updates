import { expect, test } from "bun:test";
import { $ } from "bun";
// mkdir, mkdtemp, writeFile was here;
import os from "os";
import { $ } from "bun";
import path from "path";
import { discoverPackageDirs } from "../src/workspace/discover.js";

test("discoverPackageDirs resolves package.json workspaces", async () => {
  const root = await (async () => { const d = path.join(os.tmpdir(), "rainy-updates-workspace-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(root, "package.json"),
    JSON.stringify({ name: "root", workspaces: ["packages/*"] }, null, 2),
    "utf8",
  );

  const pkgA = path.join(root, "packages", "a");
  const pkgB = path.join(root, "packages", "b");
  await $`mkdir -p ${pkgA}`;
  await $`mkdir -p ${pkgB}`;
  await (async (p, c) => await Bun.write(p, c))(path.join(pkgA, "package.json"), JSON.stringify({ name: "a" }));
  await (async (p, c) => await Bun.write(p, c))(path.join(pkgB, "package.json"), JSON.stringify({ name: "b" }));

  const dirs = await discoverPackageDirs(root, true);
  expect(dirs.includes(root)).toBe(true);
  expect(dirs.includes(pkgA)).toBe(true);
  expect(dirs.includes(pkgB)).toBe(true);
});

test("discoverPackageDirs supports recursive and negated patterns", async () => {
  const root = await (async () => { const d = path.join(os.tmpdir(), "rainy-updates-workspace-recursive-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(root, "package.json"),
    JSON.stringify({ name: "root", workspaces: ["apps/**", "!apps/private/**"] }, null, 2),
    "utf8",
  );

  const appA = path.join(root, "apps", "web");
  const appB = path.join(root, "apps", "private", "internal");
  await $`mkdir -p ${appA}`;
  await $`mkdir -p ${appB}`;
  await (async (p, c) => await Bun.write(p, c))(path.join(appA, "package.json"), JSON.stringify({ name: "web" }));
  await (async (p, c) => await Bun.write(p, c))(path.join(appB, "package.json"), JSON.stringify({ name: "internal" }));

  const dirs = await discoverPackageDirs(root, true);
  expect(dirs.includes(appA)).toBe(true);
  expect(dirs.includes(appB)).toBe(false);
});

test("discoverPackageDirs ignores node_modules and hidden directories during glob expansion", async () => {
  const root = await (async () => { const d = path.join(os.tmpdir(), "rainy-updates-workspace-ignore-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(root, "package.json"),
    JSON.stringify({ name: "root", workspaces: ["**"] }, null, 2),
    "utf8",
  );

  const publicPkg = path.join(root, "packages", "visible");
  const hiddenPkg = path.join(root, ".hidden", "pkg");
  const nodeModulesPkg = path.join(root, "node_modules", "pkg");
  await $`mkdir -p ${publicPkg}`;
  await $`mkdir -p ${hiddenPkg}`;
  await $`mkdir -p ${nodeModulesPkg}`;
  await (async (p, c) => await Bun.write(p, c))(path.join(publicPkg, "package.json"), JSON.stringify({ name: "visible" }));
  await (async (p, c) => await Bun.write(p, c))(path.join(hiddenPkg, "package.json"), JSON.stringify({ name: "hidden" }));
  await (async (p, c) => await Bun.write(p, c))(path.join(nodeModulesPkg, "package.json"), JSON.stringify({ name: "node-modules" }));

  const dirs = await discoverPackageDirs(root, true);
  expect(dirs.includes(publicPkg)).toBe(true);
  expect(dirs.includes(hiddenPkg)).toBe(false);
  expect(dirs.includes(nodeModulesPkg)).toBe(false);
});
