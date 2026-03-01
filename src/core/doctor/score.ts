import type {
  DoctorFinding,
  DoctorFindingCategory,
  DoctorFindingSeverity,
  DoctorScoreLabel,
} from "../../types/index.js";

export function calculateDoctorScore(findings: DoctorFinding[]): number {
  const uniqueErrorCodes = new Set(
    findings.filter((finding) => finding.severity === "error").map((finding) => finding.code),
  );
  const uniqueWarningCodes = new Set(
    findings.filter((finding) => finding.severity === "warning").map((finding) => finding.code),
  );
  return Math.max(0, 100 - uniqueErrorCodes.size * 12 - uniqueWarningCodes.size * 5);
}

export function labelDoctorScore(score: number): DoctorScoreLabel {
  if (score >= 85) return "Strong";
  if (score >= 65) return "Needs Review";
  if (score >= 40) return "Action Needed";
  return "Blocked / Critical";
}

export function countFindingsByCategory(
  findings: DoctorFinding[],
): Partial<Record<DoctorFindingCategory, number>> {
  const counts: Partial<Record<DoctorFindingCategory, number>> = {};
  for (const finding of findings) {
    counts[finding.category] = (counts[finding.category] ?? 0) + 1;
  }
  return counts;
}

export function countFindingsBySeverity(
  findings: DoctorFinding[],
): Partial<Record<DoctorFindingSeverity, number>> {
  const counts: Partial<Record<DoctorFindingSeverity, number>> = {};
  for (const finding of findings) {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  }
  return counts;
}
