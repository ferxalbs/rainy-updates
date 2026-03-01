import type { RiskFactor } from "../../types/index.js";
import type { RiskInput } from "../types.js";

export function detectMaintainerChurnRisk(input: RiskInput): RiskFactor | null {
  if (input.update.maintainerChurn !== "elevated-change") {
    return null;
  }

  return {
    code: "maintainer-churn",
    weight: 15,
    category: "behavioral-risk",
    message:
      "Maintainer profile looks unstable for a recent release based on available registry metadata.",
  };
}
