#!/usr/bin/env bun
import { $ } from "bun";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dir, "..");
const benchmarkScript = path.join(projectRoot, "scripts", "benchmark.mjs");
const scenario = Bun.env.RAINY_UPDATES_PERF_SCENARIO ?? "check";

console.log(`[perf-smoke] scenario: ${scenario}`);

async function runBenchmark(fixture, command, cacheState, runs) {
  const result = await $`bun ${benchmarkScript} ${fixture} ${command} ${cacheState} ${runs}`
    .cwd(projectRoot)
    .quiet();
  return JSON.parse(result.stdout.toString());
}

const coldResult = await runBenchmark("single-100", scenario, "cold", 3);
if (coldResult.skipped) {
  console.warn(`[perf-smoke] skipped cold run: ${coldResult.warmup.reason || coldResult.execution.reason}`);
} else {
  console.log(`[perf-smoke] cold median: ${coldResult.medianMs}ms`);
  const limit = scenario === "ci" ? 3000 : 1500;
  if (coldResult.medianMs > limit) {
    console.error(`[perf-smoke] cold median exceeds limit of ${limit}ms`);
    process.exit(1);
  }
}

const warmResult = await runBenchmark("single-100", scenario, "warm", 3);
if (warmResult.skipped) {
  console.warn(`[perf-smoke] skipped warm run: ${warmResult.warmup.reason || warmResult.execution.reason}`);
} else {
  console.log(`[perf-smoke] warm median: ${warmResult.medianMs}ms`);
  const limit = scenario === "ci" ? 1500 : 800;
  if (warmResult.medianMs > limit) {
    console.error(`[perf-smoke] warm median exceeds limit of ${limit}ms`);
    process.exit(1);
  }
}

console.log(`[perf-smoke] scenario ${scenario} passed`);
