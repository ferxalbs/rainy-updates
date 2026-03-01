import process from "node:process";
import { runTui } from "../../ui/tui.js";
import { buildReviewResult, renderReviewResult } from "../../core/review-model.js";
import { applySelectedUpdates } from "../../core/upgrade.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import type { ReviewOptions, ReviewResult } from "../../types/index.js";

export async function runReview(options: ReviewOptions): Promise<ReviewResult> {
  const review = await buildReviewResult(options);

  let selectedItems = review.items;
  if (options.interactive && review.updates.length > 0) {
    selectedItems = await runTui(review.items);
  }
  const selectedUpdates = selectedItems.map((item) => item.update);

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
