#!/usr/bin/env node
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const cliPath = path.join(projectRoot, "dist", "bin", "cli.js");

const fixture = process.argv[2] ?? "single-100";
const command = process.argv[3] ?? "check";
const cacheState = process.argv[4] ?? "cold";
const runs = Number(process.argv[5] ?? "3");
const fixtureCwd = path.join(projectRoot, "benchmarks", "fixtures", fixture);

const workspace = fixture !== "single-100";
const args = commandArgs(command, fixtureCwd, workspace);
const timings = [];
let warmup = { status: "not-requested" };
let execution = { status: "ready" };

for (let index = 0; index < runs; index += 1) {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "rainy-bench-home-"));
  try {
    if (cacheState === "warm") {
      const warmupResult = runCli(
        ["warm-cache", "--cwd", fixtureCwd, ...(workspace ? ["--workspace"] : [])],
        tempHome,
      );
      if (warmupResult.status === "skipped") {
        warmup = warmupResult;
        break;
      }
      warmup = warmupResult;
    }
    const startedAt = Date.now();
    const executionResult = runCli(args, tempHome);
    if (executionResult.status === "skipped") {
      execution = executionResult;
      break;
    }
    timings.push(Date.now() - startedAt);
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
}

timings.sort((left, right) => left - right);
const medianMs = timings[Math.floor(timings.length / 2)] ?? 0;
process.stdout.write(
  JSON.stringify(
    {
      fixture,
      command,
      cacheState,
      runs,
      timings,
      medianMs,
      warmup,
      execution,
      skipped:
        warmup.status === "skipped" || execution.status === "skipped",
    },
    null,
    2,
  ) + "\n",
);

function commandArgs(commandName, cwd, useWorkspace) {
  const base = ["--cwd", cwd];
  const workspaceArgs = useWorkspace ? ["--workspace"] : [];
  if (commandName === "review") {
    return [commandName, ...base, ...workspaceArgs, "--risk", "medium"];
  }
  if (commandName === "ci") {
    return [
      commandName,
      ...base,
      ...workspaceArgs,
      "--mode",
      "strict",
      "--format",
      "minimal",
      "--fail-on",
      "none",
    ];
  }
  if (commandName === "resolve") {
    return [commandName, ...base, ...workspaceArgs];
  }
  return [commandName, ...base, ...workspaceArgs, "--format", "minimal"];
}

function runCli(args, homeDir) {
  const result = spawnSync("node", [cliPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: homeDir,
    },
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (isRegistryUnavailable(result.status, output)) {
    return {
      status: "skipped",
      reason: "registry-unavailable",
    };
  }
  if (!isExpectedExitCode(args[0], result.status ?? 1)) {
    throw new Error(
      `Benchmark command failed: node ${[cliPath, ...args].join(" ")} (exit ${result.status ?? "null"})\n${output}`,
    );
  }
  return {
    status: "ready",
  };
}

function isExpectedExitCode(commandName, status) {
  if (status === 0) return true;
  return status === 1 && ["check", "review", "resolve", "ci", "doctor"].includes(commandName);
}

function isRegistryUnavailable(status, output) {
  if (status === 0) return false;
  return (
    output.includes("REGISTRY_ERROR") ||
    output.includes("ENOTFOUND") ||
    output.includes("EAI_AGAIN") ||
    output.includes("ECONNREFUSED")
  );
}
