import path from "node:path";
import process from "node:process";
import type { DoctorOptions } from "../../types/index.js";

export function parseDoctorArgs(args: string[]): DoctorOptions {
  const options: DoctorOptions = {
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
    decisionPlanFile: undefined,
    verify: "none",
    testCommand: undefined,
    verificationReportFile: undefined,
    ciGate: "check",
    verdictOnly: false,
    includeChangelog: false,
    agentReport: false,
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
    if (current === "--verdict-only") {
      options.verdictOnly = true;
      continue;
    }
    if (current === "--include-changelog") {
      options.includeChangelog = true;
      continue;
    }
    if (current === "--agent-report") {
      options.agentReport = true;
      continue;
    }
    if (current === "--json-file" && next) {
      options.jsonFile = path.resolve(options.cwd, next);
      i += 1;
      continue;
    }
    if (current === "--json-file") throw new Error("Missing value for --json-file");
    if (current === "--help" || current === "-h") {
      process.stdout.write(DOCTOR_HELP);
      process.exit(0);
    }
    if (current.startsWith("-")) throw new Error(`Unknown doctor option: ${current}`);
    throw new Error(`Unexpected doctor argument: ${current}`);
  }

  return options;
}

const DOCTOR_HELP = `
rup doctor — Fast dependency verdict across updates, security, policy, and peer conflicts

Usage:
  rup doctor [options]

Options:
  --verdict-only         Print the 3-line quick verdict without counts
  --include-changelog    Include release note summaries in the aggregated review data
  --agent-report         Print a prompt-ready remediation report for coding agents
  --workspace            Scan all workspace packages
  --json-file <path>     Write JSON doctor report to file
  --cwd <path>
`.trimStart();
