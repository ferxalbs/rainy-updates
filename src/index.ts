export { check } from "./core/check.js";
export { upgrade } from "./core/upgrade.js";
export { warmCache } from "./core/warm-cache.js";
export { runCi } from "./core/ci.js";
export { initCiWorkflow } from "./core/init-ci.js";
export { saveBaseline, diffBaseline } from "./core/baseline.js";
export { runHook } from "./commands/hook/runner.js";
export { runExplain } from "./commands/explain/runner.js";
export { runWatch } from "./commands/watch/runner.js";
export { runReachability } from "./commands/reachability/runner.js";
export { runExceptions } from "./commands/exceptions/runner.js";
export { runBadge } from "./commands/badge/runner.js";
export { runSupplyChain } from "./commands/supply-chain/runner.js";
export { runAttest } from "./commands/attest/runner.js";
export { runMcp } from "./commands/mcp/runner.js";
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
  ExplainOptions,
  ExplainResult,
  WatchOptions,
  WatchResult,
  ReachabilityOptions,
  ReachabilityResult,
  SupplyChainOptions,
  SupplyChainResult,
  SupplyChainFinding,
  SupplyChainScope,
  AttestOptions,
  AttestResult,
  AttestCheck,
  AttestAction,
  ExceptionsOptions,
  ExceptionsResult,
  ExceptionEntry,
  ReachabilityFinding,
  McpOptions,
  McpTransport,
  McpToolName,
  WebhookConfig,
  WebhookEvent,
  HookOptions,
  HookResult,
  BadgeOptions,
  BadgeResult,
  BadgeAction,
  BadgeOutputFormat,
  Verdict,
  RiskLevel,
  RiskCategory,
  RiskAssessment,
  RiskFactor,
  MaintainerChurnStatus,
} from "./types/index.js";
