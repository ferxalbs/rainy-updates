import type { ReviewItem, Verdict } from "../types/index.js";

export function deriveReviewVerdict(items: ReviewItem[], errors: string[]): Verdict {
  if (
    items.some(
      (item) =>
        item.update.peerConflictSeverity === "error" ||
        item.update.licenseStatus === "denied",
    )
  ) {
    return "blocked";
  }
  if (items.some((item) => item.advisories.length > 0 || item.update.riskLevel === "critical")) {
    return "actionable";
  }
  if (
    errors.length > 0 ||
    items.some((item) => item.update.riskLevel === "high" || item.update.diffType === "major")
  ) {
    return "review";
  }
  return "safe";
}
