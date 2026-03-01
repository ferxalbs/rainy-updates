import path from "node:path";
import process from "node:process";
import type { GaOptions } from "../../types/index.js";

export function parseGaArgs(args: string[]): GaOptions {
  const options: GaOptions = {
    cwd: process.cwd(),
    workspace: false,
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
    if (current === "--json-file" && next) {
      options.jsonFile = path.resolve(options.cwd, next);
      i += 1;
      continue;
    }
    if (current === "--json-file") throw new Error("Missing value for --json-file");
    if (current === "--help" || current === "-h") {
      process.stdout.write(GA_HELP);
      process.exit(0);
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
  --json-file <path>     Write JSON GA report to file
  --cwd <path>
`.trimStart();
