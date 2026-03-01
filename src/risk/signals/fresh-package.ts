import type { RiskFactor } from "../../types/index.js";
import type { RiskInput } from "../types.js";

export function detectFreshPackageRisk(input: RiskInput): RiskFactor | null {
  const age = input.update.publishAgeDays;
  if (typeof age !== "number") return null;
  if (age <= 7) {
    return {
      code: "fresh-package-7d",
      weight: 20,
      category: "behavioral-risk",
      message: `Resolved version was published ${age} day(s) ago.`,
    };
  }
  if (age <= 30) {
    return {
      code: "fresh-package-30d",
      weight: 10,
      category: "behavioral-risk",
      message: `Resolved version was published ${age} day(s) ago.`,
    };
  }
  return null;
}
