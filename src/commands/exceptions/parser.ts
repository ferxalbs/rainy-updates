import path from "node:path";
import type { ExceptionsOptions, ExceptionStatus } from "../../types/index.js";
import { getRuntimeCwd, writeStdout } from "../../utils/runtime.js";

const STATUSES: ExceptionStatus[] = [
  "not_affected",
  "affected",
  "fixed",
  "mitigated",
  "accepted_risk",
];

export function parseExceptionsArgs(args: string[]): ExceptionsOptions {
  const options: ExceptionsOptions = {
    cwd: getRuntimeCwd(),
    action: "list",
    id: undefined,
    packageName: undefined,
    cveId: undefined,
    reason: undefined,
    owner: undefined,
    evidence: undefined,
    status: undefined,
    expiresAt: undefined,
    filePath: undefined,
    format: "table",
    jsonFile: undefined,
    activeOnly: false,
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (!current.startsWith("-") && ["add", "list", "remove", "expire", "validate"].includes(current)) {
      options.action = current as ExceptionsOptions["action"];
      continue;
    }

    if (current === "--cwd" && next) {
      options.cwd = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--cwd") throw new Error("Missing value for --cwd");

    if (current === "--id" && next) {
      options.id = next;
      index += 1;
      continue;
    }
    if (current === "--id") throw new Error("Missing value for --id");

    if ((current === "--package" || current === "--package-name") && next) {
      options.packageName = next;
      index += 1;
      continue;
    }
    if (current === "--package" || current === "--package-name") {
      throw new Error("Missing value for --package");
    }

    if (current === "--cve" && next) {
      options.cveId = next;
      index += 1;
      continue;
    }
    if (current === "--cve") throw new Error("Missing value for --cve");

    if (current === "--reason" && next) {
      options.reason = next;
      index += 1;
      continue;
    }
    if (current === "--reason") throw new Error("Missing value for --reason");

    if (current === "--owner" && next) {
      options.owner = next;
      index += 1;
      continue;
    }
    if (current === "--owner") throw new Error("Missing value for --owner");

    if (current === "--evidence" && next) {
      options.evidence = next;
      index += 1;
      continue;
    }
    if (current === "--evidence") throw new Error("Missing value for --evidence");

    if (current === "--status" && next) {
      if (!STATUSES.includes(next as ExceptionStatus)) {
        throw new Error(`--status must be one of: ${STATUSES.join(", ")}`);
      }
      options.status = next as ExceptionStatus;
      index += 1;
      continue;
    }
    if (current === "--status") throw new Error("Missing value for --status");

    if (current === "--expires-at" && next) {
      options.expiresAt = next;
      index += 1;
      continue;
    }
    if (current === "--expires-at") throw new Error("Missing value for --expires-at");

    if (current === "--file" && next) {
      options.filePath = path.resolve(options.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--file") throw new Error("Missing value for --file");

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

    if (current === "--active-only") {
      options.activeOnly = true;
      continue;
    }

    if (current === "--strict") {
      options.strict = true;
      continue;
    }

    if (current === "--help" || current === "-h") {
      writeStdout(EXCEPTIONS_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) throw new Error(`Unknown exceptions option: ${current}`);
    throw new Error(`Unexpected exceptions argument: ${current}`);
  }

  if (options.jsonFile && options.format !== "json") {
    options.format = "json";
  }

  return options;
}

const EXCEPTIONS_HELP = `
rup exceptions — Manage VEX-like dependency exceptions

Usage:
  rup exceptions list [options]
  rup exceptions add --package <name> --reason <text> --owner <team> --evidence <text> --status <status> --expires-at <iso-date> [options]
  rup exceptions remove --id <id> [options]
  rup exceptions expire --id <id> [options]
  rup exceptions validate [options]

Options:
  --file <path>
  --active-only
  --strict
  --format table|json
  --json-file <path>
  --cwd <path>
`.trimStart();
