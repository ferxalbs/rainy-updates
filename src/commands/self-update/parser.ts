import path from "node:path";
import type { SelfUpdateOptions } from "../../types/index.js";
import { exitProcess, getRuntimeCwd, writeStdout } from "../../utils/runtime.js";

export function parseSelfUpdateArgs(args: string[]): SelfUpdateOptions {
  const options: SelfUpdateOptions = {
    cwd: getRuntimeCwd(),
    action: "check",
    yes: false,
    packageManager: "auto",
    jsonFile: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (current === "--cwd" && next) {
      options.cwd = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--cwd") throw new Error("Missing value for --cwd");
    if (current === "--check") {
      options.action = "check";
      continue;
    }
    if (current === "--apply") {
      options.action = "apply";
      continue;
    }
    if (current === "--yes") {
      options.yes = true;
      continue;
    }
    if (current === "--pm" && next) {
      if (!["auto", "bun", "npm", "pnpm"].includes(next)) {
        throw new Error("--pm must be auto, bun, npm, or pnpm");
      }
      options.packageManager = next as SelfUpdateOptions["packageManager"];
      index += 1;
      continue;
    }
    if (current === "--pm") throw new Error("Missing value for --pm");
    if (current === "--json-file" && next) {
      options.jsonFile = path.resolve(options.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--json-file") throw new Error("Missing value for --json-file");
    if (current === "--help" || current === "-h") {
      writeStdout(SELF_UPDATE_HELP);
      exitProcess(0);
    }
    if (current.startsWith("-")) throw new Error(`Unknown self-update option: ${current}`);
    throw new Error(`Unexpected self-update argument: ${current}`);
  }

  return options;
}

const SELF_UPDATE_HELP = `
rup self-update — Check or apply Rainy CLI updates for global installs

Usage:
  rup self-update [options]

Options:
  --check               Check for a newer Rainy CLI release (default)
  --apply               Apply global CLI update using detected package manager
  --yes                 Confirm and run update command without prompt
  --pm auto|bun|npm|pnpm
  --json-file <path>    Write JSON self-update report to file
  --cwd <path>
`.trimStart();
