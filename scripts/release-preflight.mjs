#!/usr/bin/env bun
import { $ } from "bun";
import path from "path";

const projectRoot = path.resolve(import.meta.dir, "..");

console.log("[release-preflight] starting checks...");

await $`bun run check`.cwd(projectRoot).inherit();

await $`bun run build`.cwd(projectRoot).inherit();

await $`bun run build:exe`.cwd(projectRoot).inherit();

await $`bun run test:prod`.cwd(projectRoot).inherit();

const packageJson = await Bun.file(path.join(projectRoot, "package.json")).json();
const version = packageJson.version;
const changelog = await Bun.file(path.join(projectRoot, "CHANGELOG.md")).text();

if (!changelog.includes(version)) {
  console.error(`[release-preflight] version ${version} not found in CHANGELOG.md`);
  process.exit(1);
}

const status = await $`git status --porcelain`.quiet();
if (status.stdout.toString().trim() !== "") {
  console.warn("[release-preflight] warning: uncommitted changes detected");
}

console.log("[release-preflight] all checks passed. ready for release.");
