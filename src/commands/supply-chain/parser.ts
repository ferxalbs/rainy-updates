import path from "node:path";
import type { SupplyChainOptions, SupplyChainScope } from "../../types/index.js";
import { getRuntimeCwd, writeStdout } from "../../utils/runtime.js";

const ALL_SCOPES: SupplyChainScope[] = ["docker", "actions", "terraform", "helm"];

export function parseSupplyChainArgs(args: string[]): SupplyChainOptions {
  const options: SupplyChainOptions = {
    cwd: getRuntimeCwd(),
    workspace: false,
    scopes: [...ALL_SCOPES],
    format: "table",
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

    if (current === "--workspace") {
      options.workspace = true;
      continue;
    }

    if (current === "--scope" && next) {
      const normalized = next.trim().toLowerCase();
      if (normalized === "all") {
        options.scopes = [...ALL_SCOPES];
      } else {
        const entries = normalized.split(",").map((entry) => entry.trim()).filter(Boolean);
        const invalid = entries.filter((entry) => !ALL_SCOPES.includes(entry as SupplyChainScope));
        if (invalid.length > 0) {
          throw new Error("--scope must be all or a comma-separated list of docker, actions, terraform, helm");
        }
        options.scopes = Array.from(new Set(entries)) as SupplyChainScope[];
      }
      index += 1;
      continue;
    }
    if (current === "--scope") throw new Error("Missing value for --scope");

    if (current === "--format" && next) {
      if (next !== "table" && next !== "json" && next !== "summary") {
        throw new Error("--format must be table, json, or summary");
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
      writeStdout(SUPPLY_CHAIN_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) throw new Error(`Unknown supply-chain option: ${current}`);
    throw new Error(`Unexpected supply-chain argument: ${current}`);
  }

  if (options.jsonFile && options.format !== "json") {
    options.format = "json";
  }

  return options;
}

const SUPPLY_CHAIN_HELP = `
rup supply-chain — Scan cross-stack supply-chain surfaces

Usage:
  rup supply-chain [options]

Options:
  --workspace
  --scope all|docker|actions|terraform|helm
  --format table|json|summary
  --json-file <path>
  --cwd <path>
`.trimStart();
