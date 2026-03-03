import type { UnusedOptions } from "../../types/index.js";

const DEFAULT_SRC_DIRS = ["src"];

export function parseUnusedArgs(args: string[]): UnusedOptions {
  const options: UnusedOptions = {
    cwd: process.cwd(),
    workspace: false,
    affected: false,
    staged: false,
    baseRef: undefined,
    headRef: undefined,
    sinceRef: undefined,
    srcDirs: DEFAULT_SRC_DIRS,
    includeDevDependencies: true,
    fix: false,
    dryRun: false,
    jsonFile: undefined,
    concurrency: 16,
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
      i++;
      continue;
    }
    if (current === "--base") throw new Error("Missing value for --base");
    if (current === "--head" && next) {
      options.headRef = next;
      i++;
      continue;
    }
    if (current === "--head") throw new Error("Missing value for --head");
    if (current === "--since" && next) {
      options.sinceRef = next;
      i++;
      continue;
    }
    if (current === "--since") throw new Error("Missing value for --since");

    if (current === "--src" && next) {
      options.srcDirs = next
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
      continue;
    }
    if (current === "--src") throw new Error("Missing value for --src");

    if (current === "--no-dev") {
      options.includeDevDependencies = false;
      continue;
    }

    if (current === "--fix") {
      options.fix = true;
      continue;
    }
    if (current === "--dry-run") {
      options.dryRun = true;
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
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0)
        throw new Error("--concurrency must be a positive integer");
      options.concurrency = parsed;
      i++;
      continue;
    }
    if (current === "--concurrency")
      throw new Error("Missing value for --concurrency");

    if (current === "--help" || current === "-h") {
      process.stdout.write(UNUSED_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) throw new Error(`Unknown option: ${current}`);
  }

  return options;
}

const UNUSED_HELP = `
rup unused — Detect unused and missing npm dependencies

Usage:
  rup unused [options]

Options:
  --src <dirs>          Comma-separated source directories to scan (default: src)
  --workspace           Scan all workspace packages
  --affected            Scan changed workspace packages and their dependents
  --staged              Limit scanning to staged changes
  --base <ref>          Compare changes against a base git ref
  --head <ref>          Compare changes against a head git ref
  --since <ref>         Compare changes since a git ref
  --no-dev              Exclude devDependencies from unused detection
  --fix                 Remove unused dependencies from package.json
  --dry-run             Preview changes without writing
  --json-file <path>    Write JSON report to file
  --cwd <path>          Working directory (default: cwd)
  --concurrency <n>     Parallel file scanning concurrency (default: 16)
  --help                Show this help

Exit codes:
  0  No unused dependencies found
  1  Unused or missing dependencies detected
`.trimStart();
