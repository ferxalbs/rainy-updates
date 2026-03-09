import path from "node:path";
import type { AttestAction, AttestOptions } from "../../types/index.js";
import { getRuntimeCwd, writeStdout } from "../../utils/runtime.js";

export function parseAttestArgs(args: string[]): AttestOptions {
  const options: AttestOptions = {
    cwd: getRuntimeCwd(),
    workspace: false,
    action: "verify",
    requireProvenance: true,
    requireSbom: true,
    requireSigning: true,
    format: "table",
    jsonFile: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (!current.startsWith("-") && (current === "verify" || current === "report")) {
      options.action = current as AttestAction;
      continue;
    }

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

    if (current === "--action" && next) {
      if (next !== "verify" && next !== "report") {
        throw new Error("--action must be verify or report");
      }
      options.action = next;
      index += 1;
      continue;
    }
    if (current === "--action") throw new Error("Missing value for --action");

    if (current === "--require-provenance") {
      options.requireProvenance = true;
      continue;
    }

    if (current === "--require-sbom") {
      options.requireSbom = true;
      continue;
    }

    if (current === "--require-signing") {
      options.requireSigning = true;
      continue;
    }

    if (current === "--no-require-provenance") {
      options.requireProvenance = false;
      continue;
    }

    if (current === "--no-require-sbom") {
      options.requireSbom = false;
      continue;
    }

    if (current === "--no-require-signing") {
      options.requireSigning = false;
      continue;
    }

    if (current === "--format" && next) {
      if (next !== "table" && next !== "json") {
        throw new Error("--format must be table or json");
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
      writeStdout(ATTEST_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) throw new Error(`Unknown attest option: ${current}`);
    throw new Error(`Unexpected attest argument: ${current}`);
  }

  if (options.jsonFile && options.format !== "json") {
    options.format = "json";
  }

  return options;
}

const ATTEST_HELP = `
rup attest — Verify provenance and signing release posture

Usage:
  rup attest [verify|report] [options]

Options:
  --workspace
  --action verify|report
  --require-provenance
  --require-sbom
  --require-signing
  --no-require-provenance
  --no-require-sbom
  --no-require-signing
  --format table|json
  --json-file <path>
  --cwd <path>
`.trimStart();
