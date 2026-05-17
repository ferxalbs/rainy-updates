#!/usr/bin/env bun
import { $ } from "bun";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dir, "..");
const binPath = path.join(projectRoot, "dist", "bin", "cli.js");

console.log(`[test-prod] testing production build: ${binPath}`);

const helpResult = await $`bun ${binPath} --help`.quiet();
if (helpResult.exitCode !== 0 || !helpResult.stdout.toString().includes("Usage:")) {
  console.error("[test-prod] help check failed");
  process.exit(1);
}

const versionResult = await $`bun ${binPath} --version`.quiet();
if (versionResult.exitCode !== 0) {
  console.error("[test-prod] version check failed");
  process.exit(1);
}
console.log(`[test-prod] version: ${versionResult.stdout.toString().trim()}`);

const checkResult = await $`bun ${binPath} check --cwd ${projectRoot} --format minimal`.quiet();
if (checkResult.exitCode !== 0 && checkResult.exitCode !== 1) {
  console.error(`[test-prod] check command failed with exit code ${checkResult.exitCode}`);
  console.error(checkResult.stderr.toString());
  process.exit(1);
}

const mcpResult = await $`bun ./src/bin/mcp.ts --help`.quiet();
if (mcpResult.exitCode !== 0 || !mcpResult.stdout.toString().includes("Usage:")) {
  console.error("[test-prod] mcp help check failed");
  process.exit(1);
}

console.log("[test-prod] production build smoke test passed");
