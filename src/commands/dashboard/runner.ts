import process from "node:process";
import type {
  DashboardOptions,
  DashboardResult,
  ReviewItem,
  ReviewResult,
} from "../../types/index.js";
import {
  createDecisionPlan,
  defaultDecisionPlanPath,
  filterReviewItemsByFocus,
  writeDecisionPlan,
} from "../../core/decision-plan.js";
import { buildReviewResult, renderReviewResult } from "../../core/review-model.js";
import { applySelectedUpdates } from "../../core/upgrade.js";
import { runTui } from "../../ui/tui.js";

export async function runDashboard(
  options: DashboardOptions,
  prebuiltReview?: ReviewResult,
): Promise<DashboardResult> {
  const review = prebuiltReview ?? (await buildReviewResult({
    ...options,
    interactive: false,
  }));
  const visibleItems = filterReviewItemsByFocus(review.items, options.focus);
  const selectedItems = await selectDashboardItems(options, visibleItems);
  const decisionPlan = createDecisionPlan({
    review,
    selectedItems,
    sourceCommand: "dashboard",
    mode: options.mode,
    focus: options.focus,
  });
  const decisionPlanFile =
    options.decisionPlanFile ?? defaultDecisionPlanPath(options.cwd);

  await writeDecisionPlan(decisionPlanFile, decisionPlan);
  review.decisionPlan = decisionPlan;
  review.summary.decisionPlan = decisionPlanFile;
  review.summary.interactiveSurface = "dashboard";
  review.summary.queueFocus = options.focus;
  review.summary.suggestedCommand =
    options.mode === "upgrade" || options.applySelected
      ? `rup upgrade --from-plan ${decisionPlanFile}`
      : `rup upgrade --from-plan ${decisionPlanFile}`;

  if ((options.mode === "upgrade" || options.applySelected) && selectedItems.length > 0) {
    await applySelectedUpdates(
      {
        ...options,
        install: false,
        packageManager: "auto",
        sync: options.workspace,
      },
      selectedItems.map((item) => item.update),
    );
  }

  process.stdout.write(
    renderReviewResult({
      ...review,
      items: selectedItems,
      updates: selectedItems.map((item) => item.update),
    }) + "\n",
  );

  process.stderr.write(
    `[dashboard] decision plan written to ${decisionPlanFile}\n`,
  );

  return {
    completed: true,
    errors: review.errors,
    warnings: review.warnings,
    selectedUpdates: selectedItems.length,
    decisionPlanFile,
  };
}

async function selectDashboardItems(
  options: DashboardOptions,
  visibleItems: ReviewItem[],
): Promise<ReviewItem[]> {
  if (visibleItems.length === 0) {
    return [];
  }

  return runTui(visibleItems, {
    title:
      options.mode === "upgrade"
        ? "Rainy Dashboard: Upgrade Queue"
        : "Rainy Dashboard: Review Queue",
    subtitle: `focus=${options.focus}  mode=${options.mode}  Enter confirms the selected decision set`,
  });
}
