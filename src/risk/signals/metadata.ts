import type { RiskFactor } from "../../types/index.js";
import type { RiskInput } from "../types.js";

export function detectSuspiciousMetadataRisk(
  input: RiskInput,
): RiskFactor | null {
  const { homepage, repository } = input.update;
  const homepageMissing = !homepage;
  const repositoryMissing = !repository;
  const repositoryMalformed =
    typeof repository === "string" &&
    !repository.startsWith("http://") &&
    !repository.startsWith("https://") &&
    !repository.startsWith("git+");

  if ((homepageMissing && repositoryMissing) || repositoryMalformed) {
    return {
      code: "suspicious-metadata",
      weight: 10,
      category: "behavioral-risk",
      message:
        "Package metadata is incomplete or uses a non-canonical repository reference.",
    };
  }

  return null;
}
