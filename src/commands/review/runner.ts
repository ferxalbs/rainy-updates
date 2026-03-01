import process from "node:process";
import { runTui } from "../../ui/tui.js";
import { buildReviewResult, renderReviewResult } from "../../core/review-model.js";
import { applySelectedUpdates } from "../../core/upgrade.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import type { ReviewOptions, ReviewResult } from "../../types/index.js";

export async function runReview(options: ReviewOptions): Promise<ReviewResult> {
  const review = await buildReviewResult(options);

  let selectedUpdates = review.updates;
  if (options.interactive && review.updates.length > 0) {
    selectedUpdates = await runTui(review.updates);
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
    updates: selectedUpdates,
    items: review.items.filter((item) =>
      selectedUpdates.some((selected) => selected.name === item.update.name && selected.packagePath === item.update.packagePath),
    ),
  }) + "\n");

  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(review, 2) + "\n");
  }

  return review;
}
