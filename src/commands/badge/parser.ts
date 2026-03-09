import path from "node:path";
import type { BadgeOptions } from "../../types/index.js";
import { getRuntimeCwd, writeStdout } from "../../utils/runtime.js";

export function parseBadgeArgs(args: string[]): BadgeOptions {
  const options: BadgeOptions = {
    cwd: getRuntimeCwd(),
    action: "url",
    owner: undefined,
    repo: undefined,
    branch: "main",
    badgePath: "badges/health.json",
    workflowFile: ".github/workflows/health-badge.yml",
    snippetFile: ".artifacts/badges/README-badge-snippet.md",
    updateReadme: false,
    force: false,
    format: "text",
    jsonFile: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (index === 0 && (current === "init" || current === "url")) {
      options.action = current;
      continue;
    }

    if (current === "--cwd" && next) {
      options.cwd = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--cwd") throw new Error("Missing value for --cwd");

    if (current === "--owner" && next) {
      options.owner = next;
      index += 1;
      continue;
    }
    if (current === "--owner") throw new Error("Missing value for --owner");

    if (current === "--repo" && next) {
      options.repo = next;
      index += 1;
      continue;
    }
    if (current === "--repo") throw new Error("Missing value for --repo");

    if (current === "--branch" && next) {
      options.branch = next;
      index += 1;
      continue;
    }
    if (current === "--branch") throw new Error("Missing value for --branch");

    if (current === "--badge-path" && next) {
      options.badgePath = next;
      index += 1;
      continue;
    }
    if (current === "--badge-path") throw new Error("Missing value for --badge-path");

    if (current === "--workflow-file" && next) {
      options.workflowFile = path.resolve(options.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--workflow-file") throw new Error("Missing value for --workflow-file");

    if (current === "--snippet-file" && next) {
      options.snippetFile = path.resolve(options.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--snippet-file") throw new Error("Missing value for --snippet-file");

    if (current === "--readme") {
      options.updateReadme = true;
      continue;
    }

    if (current === "--force") {
      options.force = true;
      continue;
    }

    if (current === "--format" && next) {
      if (next !== "text" && next !== "json") {
        throw new Error("--format must be text or json");
      }
      options.format = next;
      index += 1;
      continue;
    }
    if (current === "--format") throw new Error("Missing value for --format");

    if (current === "--json-file" && next) {
      options.jsonFile = path.resolve(options.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--json-file") throw new Error("Missing value for --json-file");

    if (current === "--help" || current === "-h") {
      writeStdout(BADGE_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) throw new Error(`Unknown badge option: ${current}`);
    throw new Error(`Unexpected badge argument: ${current}`);
  }

  if (options.jsonFile) {
    options.format = "json";
  }

  return options;
}

const BADGE_HELP = `
rup badge — Generate and publish repository health badge setup

Usage:
  rup badge url [options]
  rup badge init [options]

Options:
  --owner <owner>            GitHub owner/org (auto-detected if possible)
  --repo <repo>              GitHub repository name (auto-detected if possible)
  --branch <name>            Default branch for workflow trigger (default: main)
  --badge-path <path>        Path served by GitHub Pages (default: badges/health.json)
  --workflow-file <path>     Workflow output path (default: .github/workflows/health-badge.yml)
  --snippet-file <path>      README snippet output path (default: .artifacts/badges/README-badge-snippet.md)
  --readme                   Append badge block into README.md when using init
  --force                    Overwrite existing workflow in init mode
  --format text|json
  --json-file <path>
  --cwd <path>
`.trimStart();
