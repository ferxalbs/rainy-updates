export { check } from "./core/check.js";
export { upgrade } from "./core/upgrade.js";
export { createSarifReport } from "./output/sarif.js";
export { writeGitHubOutput, renderGitHubAnnotations } from "./output/github.js";
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
