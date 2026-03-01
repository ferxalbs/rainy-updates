export { check } from "./core/check.js";
export { upgrade } from "./core/upgrade.js";
export { warmCache } from "./core/warm-cache.js";
export { runCi } from "./core/ci.js";
export { initCiWorkflow } from "./core/init-ci.js";
export { saveBaseline, diffBaseline } from "./core/baseline.js";
export { createSarifReport } from "./output/sarif.js";
export { writeGitHubOutput, renderGitHubAnnotations } from "./output/github.js";
export { renderPrReport } from "./output/pr-report.js";
export { buildReviewResult, createDoctorResult } from "./core/review-model.js";
export { applyRiskAssessments } from "./risk/index.js";
export type {
  CheckOptions,
  CheckResult,
  CiProfile,
  DependencyKind,
  FailOnLevel,
  GroupBy,
  OutputFormat,
  PackageUpdate,
  RunOptions,
  TargetLevel,
  UpgradeOptions,
  UpgradeResult,
  ReviewOptions,
  ReviewResult,
  DoctorOptions,
  DoctorResult,
  Verdict,
  RiskLevel,
  RiskCategory,
  RiskAssessment,
  RiskFactor,
  MaintainerChurnStatus,
} from "./types/index.js";
