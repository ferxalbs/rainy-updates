import process from "node:process";
import { buildReviewResult, renderReviewResult } from "../../core/review-model.js";
import { applySelectedUpdates } from "../../core/upgrade.js";
import { createDecisionPlan, writeDecisionPlan } from "../../core/decision-plan.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import type { ReviewOptions, ReviewResult } from "../../types/index.js";

export async function runReview(options: ReviewOptions): Promise<ReviewResult> {
  const review = await buildReviewResult(options);

  if (options.interactive && review.updates.length > 0) {
    const { runDashboard } = await import("../dashboard/runner.js");
    const dashboard = await runDashboard(
      {
        ...options,
        mode: options.applySelected ? "upgrade" : "review",
        focus: options.queueFocus ?? "all",
        applySelected: options.applySelected,
      },
      review,
    );
    review.summary.decisionPlan = dashboard.decisionPlanFile;
    review.summary.interactiveSurface = "dashboard";
    review.summary.queueFocus = options.queueFocus ?? "all";
    if (options.jsonFile) {
      await writeFileAtomic(options.jsonFile, stableStringify(review, 2) + "\n");
    }
    return review;
  }
  let selectedItems = review.items;
  const selectedUpdates = selectedItems.map((item) => item.update);

  if (options.decisionPlanFile) {
    const decisionPlan = createDecisionPlan({
      review,
      selectedItems,
      sourceCommand: "review",
      mode: options.applySelected ? "upgrade" : "review",
      focus: options.queueFocus ?? "all",
    });
    const decisionPlanFile = options.decisionPlanFile;
    await writeDecisionPlan(decisionPlanFile, decisionPlan);
    review.decisionPlan = decisionPlan;
    review.summary.decisionPlan = decisionPlanFile;
  }

  if (options.applySelected && selectedUpdates.length > 0) {
    await applySelectedUpdates(
      {
        ...options,
        install: false,
        packageManager: "auto",
        sync: false,
      },
      selectedUpdates,
    );
  }

  process.stdout.write(renderReviewResult({
    ...review,
    items: selectedItems,
    updates: selectedUpdates,
  }) + "\n");

  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(review, 2) + "\n");
  }

  return review;
}
