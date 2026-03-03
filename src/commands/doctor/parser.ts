import path from "node:path";
import type { DoctorOptions } from "../../types/index.js";
import {
  exitProcess,
  getRuntimeCwd,
  writeStdout,
} from "../../utils/runtime.js";

export function parseDoctorArgs(args: string[]): DoctorOptions {
  const options: DoctorOptions = {
    cwd: getRuntimeCwd(),
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
    affected: false,
    staged: false,
    baseRef: undefined,
    headRef: undefined,
    sinceRef: undefined,
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
    if (current === "--only-changed") {
      options.onlyChanged = true;
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
      i += 1;
      continue;
    }
    if (current === "--base") throw new Error("Missing value for --base");
    if (current === "--head" && next) {
      options.headRef = next;
      i += 1;
      continue;
    }
    if (current === "--head") throw new Error("Missing value for --head");
    if (current === "--since" && next) {
      options.sinceRef = next;
      i += 1;
      continue;
    }
    if (current === "--since") throw new Error("Missing value for --since");
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
      writeStdout(DOCTOR_HELP);
      exitProcess(0);
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
  --only-changed         Limit analysis to changed packages
  --affected             Include changed packages and their dependents
  --staged               Limit analysis to staged changes
  --base <ref>           Compare changes against a base git ref
  --head <ref>           Compare changes against a head git ref
  --since <ref>          Compare changes since a git ref
  --json-file <path>     Write JSON doctor report to file
  --cwd <path>
`.trimStart();
