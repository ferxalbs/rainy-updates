import type { ReviewItem } from "../types/index.js";
import type { RiskContext } from "./types.js";
import { assessRisk } from "./scorer.js";

export function applyRiskAssessments(
  items: ReviewItem[],
  context: RiskContext,
): ReviewItem[] {
  return items.map((item) => {
    const assessment = assessRisk(
      {
        update: item.update,
        advisories: item.advisories,
        health: item.health,
        peerConflicts: item.peerConflicts,
        licenseViolation: item.update.licenseStatus === "denied",
        unusedIssues: item.unusedIssues,
      },
      context,
    );

    return {
      ...item,
      update: {
        ...item.update,
        riskLevel: assessment.level,
        riskScore: assessment.score,
        riskReasons: assessment.reasons,
        riskCategories: assessment.categories,
        recommendedAction: assessment.recommendedAction,
      },
    };
  });
}
