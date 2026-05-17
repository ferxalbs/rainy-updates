import path from "node:path";
import type { GaOptions } from "../../types/index.js";
import {
  exitProcess,
  getRuntimeCwd,
  writeStdout,
} from "../../utils/runtime.js";

export function parseGaArgs(args: string[]): GaOptions {
  const options: GaOptions = {
    cwd: getRuntimeCwd(),
    workspace: false,
    affected: false,
    staged: false,
    baseRef: undefined,
    headRef: undefined,
    sinceRef: undefined,
    jsonFile: undefined,
  };

  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    const next = args[i + 1];
    if (current === "--cwd" && next) {
      options.cwd = path.resolve(next);
      i += 1;
      continue;
    }
    if (current === "--cwd") throw new Error("Missing value for --cwd");
    if (current === "--workspace") {
      options.workspace = true;
      continue;
    }
    if (current === "--affected") {
      options.affected = true;
      continue;
    }
    if (current === "--staged") {
      options.staged = true;
      continue;
    }
    if (current === "--base" && next) {
      options.baseRef = next;
      i += 1;
      continue;
    }
    if (current === "--base") throw new Error("Missing value for --base");
    if (current === "--head" && next) {
      options.headRef = next;
      i += 1;
      continue;
    }
    if (current === "--head") throw new Error("Missing value for --head");
    if (current === "--since" && next) {
      options.sinceRef = next;
      i += 1;
      continue;
    }
    if (current === "--since") throw new Error("Missing value for --since");
    if (current === "--json-file" && next) {
      options.jsonFile = path.resolve(options.cwd, next);
      i += 1;
      continue;
    }
    if (current === "--json-file") throw new Error("Missing value for --json-file");
    if (current === "--help" || current === "-h") {
      writeStdout(GA_HELP);
      exitProcess(0);
    }
    if (current.startsWith("-")) throw new Error(`Unknown ga option: ${current}`);
    throw new Error(`Unexpected ga argument: ${current}`);
  }

  return options;
}

const GA_HELP = `
rup ga — Audit release and CI readiness for Rainy Updates

Usage:
  rup ga [options]

Options:
  --workspace            Evaluate workspace package coverage
  --affected             Evaluate changed workspace packages and dependents
  --staged               Limit GA discovery to staged changes
  --base <ref>           Compare changes against a base git ref
  --head <ref>           Compare changes against a head git ref
  --since <ref>          Compare changes since a git ref
  --json-file <path>     Write JSON GA report to file
  --cwd <path>
`.trimStart();
