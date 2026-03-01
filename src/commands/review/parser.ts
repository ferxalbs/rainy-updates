import path from "node:path";
import process from "node:process";
import type { ReviewOptions } from "../../types/index.js";
import { ensureRiskLevel } from "../../core/options.js";

export function parseReviewArgs(args: string[]): ReviewOptions {
  const options: ReviewOptions = {
    cwd: process.cwd(),
    target: "latest",
    filter: undefined,
    reject: undefined,
    cacheTtlSeconds: 3600,
    includeKinds: ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"],
    ci: false,
    format: "table",
    workspace: false,
    jsonFile: undefined,
    githubOutputFile: undefined,
    sarifFile: undefined,
    concurrency: 16,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    offline: false,
    stream: false,
    policyFile: undefined,
    prReportFile: undefined,
    failOn: "none",
    maxUpdates: undefined,
    fixPr: false,
    fixBranch: "chore/rainy-updates",
    fixCommitMessage: undefined,
    fixDryRun: false,
    fixPrNoCheckout: false,
    fixPrBatchSize: undefined,
    noPrReport: false,
    logLevel: "info",
    groupBy: "risk",
    groupMax: undefined,
    cooldownDays: undefined,
    prLimit: undefined,
    onlyChanged: false,
    ciProfile: "minimal",
    lockfileMode: "preserve",
    interactive: false,
    showImpact: true,
    showHomepage: true,
    securityOnly: false,
    risk: undefined,
    diff: undefined,
    applySelected: false,
    showChangelog: false,
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
    if (current === "--interactive") {
      options.interactive = true;
      continue;
    }
    if (current === "--security-only") {
      options.securityOnly = true;
      continue;
    }
    if (current === "--risk" && next) {
      options.risk = ensureRiskLevel(next);
      i += 1;
      continue;
    }
    if (current === "--risk") throw new Error("Missing value for --risk");
    if (current === "--diff" && next) {
      if (
        next === "patch" ||
        next === "minor" ||
        next === "major" ||
        next === "latest"
      ) {
        options.diff = next;
        i += 1;
        continue;
      }
      throw new Error("--diff must be patch, minor, major or latest");
    }
    if (current === "--diff") throw new Error("Missing value for --diff");
    if (current === "--apply-selected") {
      options.applySelected = true;
      continue;
    }
    if (current === "--show-changelog") {
      options.showChangelog = true;
      continue;
    }
    if (current === "--json-file" && next) {
      options.jsonFile = path.resolve(options.cwd, next);
      i += 1;
      continue;
    }
    if (current === "--json-file") throw new Error("Missing value for --json-file");
    if (current === "--policy-file" && next) {
      options.policyFile = path.resolve(options.cwd, next);
      i += 1;
      continue;
    }
    if (current === "--policy-file") throw new Error("Missing value for --policy-file");
    if (current === "--concurrency" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--concurrency must be a positive integer");
      }
      options.concurrency = parsed;
      i += 1;
      continue;
    }
    if (current === "--concurrency") throw new Error("Missing value for --concurrency");
    if (current === "--registry-timeout-ms" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--registry-timeout-ms must be a positive integer");
      }
      options.registryTimeoutMs = parsed;
      i += 1;
      continue;
    }
    if (current === "--registry-timeout-ms") {
      throw new Error("Missing value for --registry-timeout-ms");
    }
    if (current === "--registry-retries" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--registry-retries must be a positive integer");
      }
      options.registryRetries = parsed;
      i += 1;
      continue;
    }
    if (current === "--registry-retries") {
      throw new Error("Missing value for --registry-retries");
    }
    if (current === "--help" || current === "-h") {
      process.stdout.write(REVIEW_HELP);
      process.exit(0);
    }
    if (current.startsWith("-")) throw new Error(`Unknown review option: ${current}`);
    throw new Error(`Unexpected review argument: ${current}`);
  }

  return options;
}

const REVIEW_HELP = `
rup review — Guided dependency review across updates, security, peer conflicts, and policy

Usage:
  rup review [options]

Options:
  --interactive           Launch the interactive review TUI
  --security-only         Show only packages with advisories
  --risk <level>          Minimum risk: critical, high, medium, low
  --diff <level>          Filter by patch, minor, major, latest
  --apply-selected        Apply all filtered updates after review
  --show-changelog        Fetch release notes summaries for review output
  --workspace             Scan all workspace packages
  --policy-file <path>    Load policy overrides
  --json-file <path>      Write JSON review report to file
  --registry-timeout-ms <n>
  --registry-retries <n>
  --concurrency <n>
  --cwd <path>
`.trimStart();
