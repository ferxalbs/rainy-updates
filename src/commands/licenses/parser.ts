import type { LicenseOptions } from "../../types/index.js";

export function parseLicensesArgs(args: string[]): LicenseOptions {
  const options: LicenseOptions = {
    cwd: process.cwd(),
    workspace: false,
    allow: undefined,
    deny: undefined,
    sbomFile: undefined,
    jsonFile: undefined,
    diffMode: false,
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
    if (current === "--diff") {
      options.diffMode = true;
      continue;
    }

    if (current === "--allow" && next) {
      options.allow = next
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
      continue;
    }
    if (current === "--allow") throw new Error("Missing value for --allow");

    if (current === "--deny" && next) {
      options.deny = next
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      i++;
      continue;
    }
    if (current === "--deny") throw new Error("Missing value for --deny");

    if (current === "--sbom" && next) {
      options.sbomFile = next;
      i++;
      continue;
    }
    if (current === "--sbom") throw new Error("Missing value for --sbom");

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
      process.stdout.write(LICENSES_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) throw new Error(`Unknown option: ${current}`);
  }

  return options;
}

const LICENSES_HELP = `
rup licenses — Scan dependency licenses and generate SPDX SBOM

Usage:
  rup licenses [options]

Options:
  --allow <spdx,...>     Allow only these SPDX identifiers (e.g. MIT,Apache-2.0)
  --deny <spdx,...>      Deny these SPDX identifiers (e.g. GPL-3.0)
  --sbom <path>          Write SPDX 2.3 SBOM JSON to file
  --json-file <path>     Write JSON report to file
  --diff                 Show only packages with a different license than last scan
  --workspace            Scan all workspace packages
  --timeout <ms>         Registry request timeout (default: 10000)
  --concurrency <n>      Parallel registry requests (default: 12)
  --cwd <path>           Working directory (default: cwd)
  --help                 Show this help

Exit codes:
  0  No violations
  1  License violations detected
`.trimStart();
