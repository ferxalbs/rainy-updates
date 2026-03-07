import { applySelectedUpdates } from "../core/upgrade.js";
import { buildReviewResult } from "../core/review-model.js";
import {
  createDecisionPlan,
  writeDecisionPlan,
} from "../core/decision-plan.js";
import type {
  ReviewOptions,
  ReviewResult,
  ServiceContext,
  UpgradeOptions,
} from "../types/index.js";

export async function runReviewService(
  options: ReviewOptions,
  _context?: ServiceContext,
): Promise<ReviewResult> {
  const review = await buildReviewResult(options);
  const selectedItems = review.items;
  const selectedUpdates = selectedItems.map((item) => item.update);

  if (options.decisionPlanFile) {
    const decisionPlan = createDecisionPlan({
      review,
      selectedItems,
      sourceCommand: "review",
      mode: options.applySelected ? "upgrade" : "review",
      focus: options.queueFocus ?? "all",
    });
    await writeDecisionPlan(options.decisionPlanFile, decisionPlan);
    review.decisionPlan = decisionPlan;
    review.summary.decisionPlan = options.decisionPlanFile;
  }

  if (options.applySelected && selectedUpdates.length > 0) {
    const upgradeOptions: UpgradeOptions = {
      ...options,
      install: false,
      packageManager: "auto",
      sync: false,
    };
    await applySelectedUpdates(upgradeOptions, selectedUpdates);
  }

  return review;
}
