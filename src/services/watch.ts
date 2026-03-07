import path from "node:path";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "../config/loader.js";
import { createDecisionPlan, writeDecisionPlan } from "../core/decision-plan.js";
import { runAuditService } from "./audit.js";
import { runCheckService } from "./check.js";
import { buildReviewResult } from "../core/review-model.js";
import { dispatchNotification, dispatchWebhookEvent } from "../notifications/dispatcher.js";
import type {
  AuditOptions,
  CheckOptions,
  ReviewOptions,
  ServiceContext,
  WatchOptions,
  WatchResult,
} from "../types/index.js";

interface WatchState {
  lastRunAt?: string;
  lastFingerprint?: string;
}

export async function runWatchService(
  options: WatchOptions,
  context?: ServiceContext,
): Promise<WatchResult> {
  const pidFile = options.pidFile ?? path.join(options.cwd, ".rainy", "watch.pid");
  const stateFile = options.stateFile ?? path.join(options.cwd, ".rainy", "watch-state.json");
  await mkdir(path.dirname(pidFile), { recursive: true });

  if (options.action === "stop") {
    return stopWatch(pidFile, stateFile);
  }

  if (options.action === "start" && options.daemon) {
    const child = Bun.spawn({
      cmd: [process.execPath, process.argv[1]!, "watch", "run", "--cwd", options.cwd, ...(options.workspace ? ["--workspace"] : [])],
      cwd: options.cwd,
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
      detached: true,
    });
    await Bun.write(pidFile, `${child.pid}\n`);
    child.unref();
    return {
      action: "start",
      running: true,
      pid: child.pid,
      stateFile,
      pidFile,
      updatesDetected: 0,
      advisoriesDetected: 0,
      notifications: [],
      errors: [],
      warnings: [],
    };
  }

  return executeWatchCycle(
    {
      ...options,
      action: "run",
      pidFile,
      stateFile,
    },
    context,
  );
}

async function executeWatchCycle(
  options: WatchOptions,
  _context?: ServiceContext,
): Promise<WatchResult> {
  const pidFile = options.pidFile!;
  const stateFile = options.stateFile!;
  await Bun.write(pidFile, `${process.pid}\n`);

  const config = await loadConfig(options.cwd);
  const previousState = await readState(stateFile);
  const checkOptions: CheckOptions = {
    cwd: options.cwd,
    target: "latest",
    filter: undefined,
    reject: undefined,
    cacheTtlSeconds: 3600,
    includeKinds: ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"],
    ci: false,
    format: "json",
    workspace: options.workspace,
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
    noPrReport: true,
    logLevel: "info",
    groupBy: "none",
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
  };
  const auditOptions: AuditOptions = {
    cwd: options.cwd,
    workspace: options.workspace,
    affected: false,
    staged: false,
    baseRef: undefined,
    headRef: undefined,
    sinceRef: undefined,
    severity: options.severity,
    fix: false,
    dryRun: false,
    commit: false,
    packageManager: "auto",
    reportFormat: "json",
    sourceMode: "auto",
    jsonFile: undefined,
    concurrency: 16,
    registryTimeoutMs: 8000,
    silent: true,
  };

  const [checkResult, auditResult] = await Promise.all([
    runCheckService(checkOptions),
    runAuditService(auditOptions),
  ]);

  const fingerprint = JSON.stringify(
    checkResult.updates.map((update) => ({
      packagePath: update.packagePath,
      name: update.name,
      toVersionResolved: update.toVersionResolved,
    })),
  );
  const notifications: WatchResult["notifications"] = [];
  const changed = fingerprint !== previousState.lastFingerprint;

  if (changed && options.decisionPlanFile && checkResult.updates.length > 0) {
    const reviewOptions: ReviewOptions = {
      ...checkOptions,
      securityOnly: false,
      risk: undefined,
      diff: undefined,
      applySelected: false,
      showChangelog: true,
      queueFocus: "all",
    };
    const review = await buildReviewResult(reviewOptions);
    const selectedItems = review.items.filter((item) => item.selected !== false);
    const plan = createDecisionPlan({
      review,
      selectedItems,
      sourceCommand: "watch",
      mode: "review",
      focus: "all",
    });
    await writeDecisionPlan(options.decisionPlanFile, plan);
  }

  const message = `Rainy watch detected ${checkResult.updates.length} updates and ${auditResult.advisories.length} advisories in ${options.cwd}.`;
  if (changed && options.notify && options.webhook) {
    try {
      await dispatchNotification(options.notify, options.webhook, message);
      notifications.push({
        target: options.notify,
        delivered: true,
        message,
      });
    } catch (error) {
      notifications.push({
        target: options.notify,
        delivered: false,
        message: String(error),
      });
    }
  }

  for (const webhook of config.webhooks ?? []) {
    const event =
      auditResult.advisories.some((advisory) => advisory.severity === "critical")
        ? "audit.critical"
        : checkResult.updates.length > 0
          ? "check.complete"
          : "doctor.score";
    try {
      await dispatchWebhookEvent(webhook, event, {
        cwd: options.cwd,
        updatesFound: checkResult.updates.length,
        advisoriesFound: auditResult.advisories.length,
      });
      notifications.push({
        target: "webhook-config",
        delivered: true,
        message: `${event} -> ${webhook.url}`,
      });
    } catch (error) {
      notifications.push({
        target: "webhook-config",
        delivered: false,
        message: `${event} failed: ${String(error)}`,
      });
    }
  }

  await Bun.write(
    stateFile,
    JSON.stringify(
      {
        lastRunAt: new Date().toISOString(),
        lastFingerprint: fingerprint,
      } satisfies WatchState,
      null,
      2,
    ) + "\n",
  );

  return {
    action: options.action,
    running: true,
    pid: process.pid,
    pidFile,
    stateFile,
    updatesDetected: checkResult.updates.length,
    advisoriesDetected: auditResult.advisories.length,
    notifications,
    errors: [],
    warnings: changed ? [] : ["No dependency changes detected since the last watch cycle."],
  };
}

async function stopWatch(pidFile: string, stateFile: string): Promise<WatchResult> {
  const file = Bun.file(pidFile);
  if (!(await file.exists())) {
    return {
      action: "stop",
      running: false,
      pidFile,
      stateFile,
      updatesDetected: 0,
      advisoriesDetected: 0,
      notifications: [],
      errors: [],
      warnings: ["No watch daemon PID file found."],
    };
  }

  const pid = Number((await file.text()).trim());
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    return {
      action: "stop",
      running: false,
      pid,
      pidFile,
      stateFile,
      updatesDetected: 0,
      advisoriesDetected: 0,
      notifications: [],
      errors: [String(error)],
      warnings: [],
    };
  }

  await Bun.write(pidFile, "");
  return {
    action: "stop",
    running: false,
    pid,
    pidFile,
    stateFile,
    updatesDetected: 0,
    advisoriesDetected: 0,
    notifications: [],
    errors: [],
    warnings: [],
  };
}

async function readState(stateFile: string): Promise<WatchState> {
  const file = Bun.file(stateFile);
  if (!(await file.exists())) return {};
  return (await file.json()) as WatchState;
}
