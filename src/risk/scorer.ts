import type {
  RiskAssessment,
  RiskCategory,
  RiskFactor,
  RiskLevel,
} from "../types/index.js";
import type { RiskContext, RiskInput } from "./types.js";
import { detectInstallScriptsRisk } from "./signals/install-scripts.js";
import { detectTyposquatRisk } from "./signals/typosquat.js";
import { detectFreshPackageRisk } from "./signals/fresh-package.js";
import { detectSuspiciousMetadataRisk } from "./signals/metadata.js";
import { detectMutableSourceRisk } from "./signals/mutable-source.js";
import { detectMaintainerChurnRisk } from "./signals/maintainer-churn.js";

export function assessRisk(
  input: RiskInput,
  context: RiskContext,
): RiskAssessment {
  const factors: RiskFactor[] = [];

  if (input.advisories.length > 0) {
    factors.push({
      code: "known-vulnerability",
      weight: 35,
      category: "known-vulnerability",
      message: `${input.advisories.length} known vulnerability finding(s) affect this package.`,
    });
  }

  const installScripts = detectInstallScriptsRisk(input);
  if (installScripts) factors.push(installScripts);

  const typosquat = detectTyposquatRisk(input, context);
  if (typosquat) factors.push(typosquat);

  const freshPackage = detectFreshPackageRisk(input);
  if (freshPackage) factors.push(freshPackage);

  const metadata = detectSuspiciousMetadataRisk(input);
  if (metadata) factors.push(metadata);

  const mutableSource = detectMutableSourceRisk(input);
  if (mutableSource) factors.push(mutableSource);

  const maintainerChurn = detectMaintainerChurnRisk(input);
  if (maintainerChurn) factors.push(maintainerChurn);

  if (input.peerConflicts.some((conflict) => conflict.severity === "error")) {
    factors.push({
      code: "peer-conflict",
      weight: 20,
      category: "operational-health",
      message: "Peer dependency conflicts block safe application.",
    });
  }

  if (input.licenseViolation) {
    factors.push({
      code: "license-violation",
      weight: 20,
      category: "operational-health",
      message: "License policy would block or require review for this update.",
    });
  }

  if (input.health?.flags.includes("deprecated")) {
    factors.push({
      code: "deprecated-package",
      weight: 10,
      category: "operational-health",
      message: "Package is deprecated.",
    });
  } else if (
    input.health?.flags.includes("stale") ||
    input.health?.flags.includes("unmaintained")
  ) {
    factors.push({
      code: "stale-package",
      weight: 5,
      category: "operational-health",
      message: "Package has stale operational health signals.",
    });
  }

  if (input.update.diffType === "major") {
    factors.push({
      code: "major-version",
      weight: 10,
      category: "operational-health",
      message: "Update crosses a major version boundary.",
    });
  }

  const score = Math.min(
    100,
    factors.reduce((sum, factor) => sum + factor.weight, 0),
  );
  const level = scoreToLevel(score);
  const categories = Array.from(
    new Set(factors.map((factor) => factor.category)),
  ) as RiskCategory[];
  const reasons = factors.map((factor) => factor.message);

  return {
    score,
    level,
    reasons,
    categories,
    recommendedAction: recommendAction(level, input),
    factors,
  };
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "medium";
  return "low";
}

function recommendAction(
  level: RiskLevel,
  input: RiskInput,
): string {
  if (input.peerConflicts.some((conflict) => conflict.severity === "error")) {
    return "Run `rup resolve --after-update` before applying this update.";
  }
  if (input.advisories.length > 0) {
    return "Review in `rup review` and consider `rup audit --fix` for the secure minimum patch.";
  }
  if (level === "critical" || level === "high") {
    return "Keep this update in review until the risk reasons are cleared.";
  }
  return "Safe to keep in the review queue and apply after normal verification.";
}
