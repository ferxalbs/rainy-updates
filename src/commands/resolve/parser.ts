import type { ResolveOptions } from "../../types/index.js";

export function parseResolveArgs(args: string[]): ResolveOptions {
  const options: ResolveOptions = {
    cwd: process.cwd(),
    workspace: false,
    afterUpdate: false,
    safe: false,
    jsonFile: undefined,
    concurrency: 12,
    registryTimeoutMs: 10_000,
    cacheTtlSeconds: 3600,
  };

  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    const next = args[i + 1];

    if (current === "--cwd" && next) {
      options.cwd = next;
      i++;
      continue;
    }
    if (current === "--cwd") throw new Error("Missing value for --cwd");

    if (current === "--workspace") {
      options.workspace = true;
      continue;
    }
    if (current === "--after-update") {
      options.afterUpdate = true;
      continue;
    }
    if (current === "--safe") {
      options.safe = true;
      continue;
    }

    if (current === "--json-file" && next) {
      options.jsonFile = next;
      i++;
      continue;
    }
    if (current === "--json-file")
      throw new Error("Missing value for --json-file");

    if (current === "--concurrency" && next) {
      const n = Number(next);
      if (!Number.isInteger(n) || n <= 0)
        throw new Error("--concurrency must be a positive integer");
      options.concurrency = n;
      i++;
      continue;
    }
    if (current === "--concurrency")
      throw new Error("Missing value for --concurrency");

    if (current === "--timeout" && next) {
      const ms = Number(next);
      if (!Number.isFinite(ms) || ms <= 0)
        throw new Error("--timeout must be a positive number");
      options.registryTimeoutMs = ms;
      i++;
      continue;
    }
    if (current === "--timeout") throw new Error("Missing value for --timeout");

    if (current === "--help" || current === "-h") {
      process.stdout.write(RESOLVE_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) throw new Error(`Unknown option: ${current}`);
  }

  return options;
}

const RESOLVE_HELP = `
rup resolve — Detect peer dependency conflicts (pure-TS, no subprocess spawn)

Usage:
  rup resolve [options]

Options:
  --after-update        Simulate conflicts after applying pending \`rup check\` updates
  --safe                Exit non-zero if any error-level conflicts exist
  --workspace           Scan all workspace packages
  --json-file <path>    Write JSON conflict report to file
  --timeout <ms>        Registry request timeout in ms (default: 10000)
  --concurrency <n>     Parallel registry requests (default: 12)
  --cwd <path>          Working directory (default: cwd)
  --help                Show this help

Exit codes:
  0  No conflicts
  1  One or more peer conflicts detected
`.trimStart();
