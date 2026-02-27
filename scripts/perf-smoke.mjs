#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const fixtureCwd = path.join(projectRoot, "tests", "fixtures", "perf-empty");
const cliPath = path.join(projectRoot, "dist", "bin", "cli.js");
const maxMs = Number(process.env.RAINY_UPDATES_PERF_MAX_MS ?? "1500");
const runs = 3;

function runCheck() {
  const startedAt = Date.now();
  const result = spawnSync(
    "node",
    [cliPath, "check", "--cwd", fixtureCwd, "--format", "minimal"],
    { encoding: "utf8" },
  );
  const durationMs = Date.now() - startedAt;
  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim();
    throw new Error(`perf-smoke check failed (${result.status ?? "unknown"}): ${stderr}`);
  }
  return durationMs;
}

const timings = [];
for (let index = 0; index < runs; index += 1) {
  timings.push(runCheck());
}
timings.sort((a, b) => a - b);
const medianMs = timings[Math.floor(timings.length / 2)];

process.stdout.write(`perf-smoke timings(ms): ${timings.join(", ")}; median=${medianMs}\n`);
if (medianMs > maxMs) {
  process.stderr.write(
    `perf-smoke regression: median ${medianMs}ms exceeds threshold ${maxMs}ms (RAINY_UPDATES_PERF_MAX_MS)\n`,
  );
  process.exit(1);
}
