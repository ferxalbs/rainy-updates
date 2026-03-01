import type { DoctorResult, ReviewResult, Verdict } from "../../types/index.js";
import { deriveReviewVerdict } from "../review-verdict.js";
import { buildDoctorFindings } from "./findings.js";
import {
  calculateDoctorScore,
  countFindingsByCategory,
  countFindingsBySeverity,
  labelDoctorScore,
} from "./score.js";

export function createDoctorResult(review: ReviewResult): DoctorResult {
  const verdict = review.summary.verdict ?? deriveReviewVerdict(review.items, review.errors);
  const findings = buildDoctorFindings(review);
  const score = calculateDoctorScore(findings);
  const scoreLabel = labelDoctorScore(score);
  const primaryFindings = findings.length > 0
    ? findings.map((finding) => finding.summary)
    : ["No blocking findings; remaining updates are low-risk."];
  const recommendedCommand = recommendDoctorCommand(review, verdict);
  const nextActionReason = describeNextActionReason(review, verdict);

  review.summary.dependencyHealthScore = score;
  review.summary.findingCountsByCategory = countFindingsByCategory(findings);
  review.summary.findingCountsBySeverity = countFindingsBySeverity(findings);
  review.summary.primaryFindingCode = findings[0]?.code;
  review.summary.primaryFindingCategory = findings[0]?.category;
  review.summary.nextActionReason = nextActionReason;

  return {
    verdict,
    score,
    scoreLabel,
    summary: review.summary,
    review,
    findings,
    primaryFindings,
    recommendedCommand,
    nextActionReason,
  };
}

function recommendDoctorCommand(review: ReviewResult, verdict: Verdict): string {
  if (verdict === "blocked") return "rup review --interactive";
  if ((review.summary.securityPackages ?? 0) > 0) return "rup review --security-only";
  if (review.errors.length > 0 || review.items.length > 0) return "rup review --interactive";
  return "rup check";
}

function describeNextActionReason(review: ReviewResult, verdict: Verdict): string {
  if (verdict === "blocked") {
    return "Blocked findings exist, so the update set needs an explicit package-by-package review before any mutation.";
  }
  if ((review.summary.securityPackages ?? 0) > 0) {
    return "Security advisories are present, so the next step should focus on the secure subset first.";
  }
  if (review.errors.length > 0) {
    return "Execution issues reduce trust in the current scan, so the result should be reviewed before treating it as clean.";
  }
  if (review.items.length > 0) {
    return "Reviewable updates were found, so the next step is to inspect and approve the package set.";
  }
  return "No reviewable changes remain, so a normal check is enough to verify the repository stays clean.";
}
