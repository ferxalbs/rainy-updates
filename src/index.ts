export { check } from "./core/check.js";
export { upgrade } from "./core/upgrade.js";
export { warmCache } from "./core/warm-cache.js";
export { initCiWorkflow } from "./core/init-ci.js";
export { createSarifReport } from "./output/sarif.js";
export { writeGitHubOutput, renderGitHubAnnotations } from "./output/github.js";
export { renderPrReport } from "./output/pr-report.js";
export type {
  CheckOptions,
  CheckResult,
  DependencyKind,
  OutputFormat,
  PackageUpdate,
  RunOptions,
  TargetLevel,
  UpgradeOptions,
  UpgradeResult,
} from "./types/index.js";
