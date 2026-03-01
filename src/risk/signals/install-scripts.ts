import type { RiskFactor } from "../../types/index.js";
import type { RiskInput } from "../types.js";

export function detectInstallScriptsRisk(input: RiskInput): RiskFactor | null {
  if (!input.update.hasInstallScript) return null;
  return {
    code: "install-scripts",
    weight: 20,
    category: "behavioral-risk",
    message: "Resolved package includes install lifecycle scripts.",
  };
}
