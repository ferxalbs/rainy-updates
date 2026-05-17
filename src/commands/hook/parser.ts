import path from "node:path";
import type { HookOptions } from "../../types/index.js";

export function parseHookArgs(args: string[]): HookOptions {
  let cwd = process.cwd();
  let action: HookOptions["action"] = "doctor";

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if ((current === "install" || current === "uninstall" || current === "doctor") && index === 0) {
      action = current;
      continue;
    }

    if (current === "--cwd" && next) {
      cwd = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--cwd") {
      throw new Error("Missing value for --cwd");
    }

    if (current === "--help" || current === "-h") {
      process.stdout.write(HOOK_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) {
      throw new Error(`Unknown hook option: ${current}`);
    }

    throw new Error(`Unexpected hook argument: ${current}`);
  }

  return { cwd, action };
}

const HOOK_HELP = `
rup hook — Install or inspect Rainy-managed git hooks

Usage:
  rup hook <install|uninstall|doctor> [options]

Options:
  --cwd <path>          Working directory (default: cwd)
  --help                Show this help
`.trimStart();
