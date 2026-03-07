import { renderReviewResult } from "../../core/review-model.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { writeStdout } from "../../utils/runtime.js";
import type { ReviewOptions, ReviewResult } from "../../types/index.js";
import { runReviewService } from "../../services/review.js";

export async function runReview(options: ReviewOptions): Promise<ReviewResult> {
  const review = await runReviewService(options);

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
  writeStdout(renderReviewResult({
    ...review,
    items: review.items,
    updates: review.items.map((item) => item.update),
  }) + "\n");

  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(review, 2) + "\n");
  }

  return review;
}
