import path from "node:path";
import type { DashboardOptions } from "../../types/index.js";

export function parseDashboardArgs(args: string[]): DashboardOptions {
  const options: DashboardOptions = {
    cwd: process.cwd(),
    target: "latest",
    filter: undefined,
    reject: undefined,
    includeKinds: [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ],
    cacheTtlSeconds: 3600,
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
    groupBy: "none",
    groupMax: undefined,
    cooldownDays: undefined,
    prLimit: undefined,
    onlyChanged: false,
    ciProfile: "minimal",
    lockfileMode: "preserve",
    interactive: true,
    showImpact: false,
    showHomepage: true,
    mode: "review",
    focus: "all",
    applySelected: false,
    decisionPlanFile: undefined,
    verify: "none",
    testCommand: undefined,
    verificationReportFile: undefined,
    ciGate: "check",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--view" && nextArg) {
      if (
        nextArg === "dependencies" ||
        nextArg === "security" ||
        nextArg === "health"
      ) {
        options.view = nextArg;
      } else {
        throw new Error(`Invalid --view: ${nextArg}`);
      }
      i++;
      continue;
    }
    if (arg === "--view") {
      throw new Error("Missing value for --view");
    }

    if (arg === "--mode" && nextArg) {
      if (
        nextArg === "check" ||
        nextArg === "review" ||
        nextArg === "upgrade"
      ) {
        options.mode = nextArg;
        i++;
        continue;
      }
      throw new Error(`Invalid --mode: ${nextArg}`);
    }
    if (arg === "--mode") {
      throw new Error("Missing value for --mode");
    }

    if (arg === "--focus" && nextArg) {
      if (
        nextArg === "all" ||
        nextArg === "security" ||
        nextArg === "risk" ||
        nextArg === "major" ||
        nextArg === "blocked" ||
        nextArg === "workspace"
      ) {
        options.focus = nextArg;
        i++;
        continue;
      }
      throw new Error(`Invalid --focus: ${nextArg}`);
    }
    if (arg === "--focus") {
      throw new Error("Missing value for --focus");
    }

    if (arg === "--apply-selected") {
      options.applySelected = true;
      continue;
    }

    if (arg === "--verify" && nextArg) {
      if (
        nextArg === "none" ||
        nextArg === "install" ||
        nextArg === "test" ||
        nextArg === "install,test"
      ) {
        options.verify = nextArg;
        i++;
        continue;
      }
      throw new Error(`Invalid --verify: ${nextArg}`);
    }
    if (arg === "--verify") {
      throw new Error("Missing value for --verify");
    }

    if (arg === "--test-command" && nextArg) {
      options.testCommand = nextArg;
      i++;
      continue;
    }
    if (arg === "--test-command") {
      throw new Error("Missing value for --test-command");
    }

    if (arg === "--verification-report-file" && nextArg) {
      options.verificationReportFile = path.resolve(options.cwd, nextArg);
      i++;
      continue;
    }
    if (arg === "--verification-report-file") {
      throw new Error("Missing value for --verification-report-file");
    }

    if (arg === "--plan-file" && nextArg) {
      options.decisionPlanFile = path.resolve(options.cwd, nextArg);
      i++;
      continue;
    }
    if (arg === "--plan-file") {
      throw new Error("Missing value for --plan-file");
    }

    // Pass through common workspace / cwd args
    if (arg === "--workspace") {
      options.workspace = true;
      continue;
    }

    if (arg === "--cwd" && nextArg) {
      options.cwd = path.resolve(nextArg);
      i++;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown dashboard option: ${arg}`);
    }
  }

  return options;
}
