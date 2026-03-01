import type { CheckOptions, CheckResult } from "../types/index.js";
import { check } from "./check.js";
import { warmCache } from "./warm-cache.js";
import { buildReviewResult, createDoctorResult } from "./review-model.js";
import {
  createDecisionPlan,
  defaultDecisionPlanPath,
  writeDecisionPlan,
} from "./decision-plan.js";
import { upgrade } from "./upgrade.js";

export async function runCi(options: CheckOptions): Promise<CheckResult> {
  const profile = options.ciProfile;

  if (profile !== "minimal") {
    await warmCache({
      ...options,
      offline: false,
      ci: true,
      format: "minimal",
    });
  }

  const checkOptions: CheckOptions = {
    ...options,
    ci: true,
    offline: profile === "minimal" ? options.offline : true,
    concurrency: profile === "enterprise" ? Math.max(options.concurrency, 32) : options.concurrency,
  };

  if (options.ciGate === "check") {
    return await check(checkOptions);
  }

  if (options.ciGate === "doctor") {
    const review = await buildReviewResult(checkOptions);
    createDoctorResult(review);
    return reviewToCheckResult(review);
  }

  if (options.ciGate === "review") {
    const review = await buildReviewResult(checkOptions);
    const selectedItems = review.items.filter(
      (item) =>
        item.update.selectedByDefault !== false &&
        item.update.decisionState !== "blocked",
    );
    const decisionPlanFile =
      options.decisionPlanFile ?? defaultDecisionPlanPath(options.cwd);
    const plan = createDecisionPlan({
      review,
      selectedItems,
      sourceCommand: "ci",
      mode: "review",
      focus: "all",
    });
    await writeDecisionPlan(decisionPlanFile, plan);
    review.decisionPlan = plan;
    review.summary.decisionPlan = decisionPlanFile;
    review.summary.interactiveSurface = "dashboard";
    review.summary.queueFocus = "all";
    review.summary.suggestedCommand = `rup upgrade --from-plan ${decisionPlanFile}`;
    return reviewToCheckResult(review);
  }

  const decisionPlanFile = options.decisionPlanFile ?? defaultDecisionPlanPath(options.cwd);
  return upgrade({
    ...checkOptions,
    install: false,
    packageManager: "auto",
    sync: checkOptions.workspace,
    fromPlanFile: decisionPlanFile,
  });
}

function reviewToCheckResult(review: Awaited<ReturnType<typeof buildReviewResult>>): CheckResult {
  return {
    projectPath: review.projectPath,
    packagePaths: review.analysis.check.packagePaths,
    packageManager: review.analysis.check.packageManager,
    target: review.target,
    timestamp: review.analysis.check.timestamp,
    summary: review.summary,
    updates: review.updates,
    errors: review.errors,
    warnings: review.warnings,
  };
}
