import { readDecisionPlan } from "../core/decision-plan.js";
import { buildReviewResult } from "../core/review-model.js";
import { parseVersion } from "../utils/semver.js";
import type {
  PredictItem,
  PredictOptions,
  PredictResult,
  PredictRiskLevel,
  PredictVerdict,
  ReviewOptions,
  ServiceContext,
} from "../types/index.js";

export async function runPredictService(
  options: PredictOptions,
  _context?: ServiceContext,
): Promise<PredictResult> {
  const startedAt = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  const items = options.fromPlanFile
    ? await readItemsFromPlan(options.fromPlanFile, warnings)
    : await readItemsFromReview(options, warnings, errors);

  const predictedBlocked = items.filter((item) => item.policyAction === "block").length;
  const predictedRisky = items.filter((item) => isRiskyItem(item)).length;
  const predictedSafe = Math.max(0, items.length - predictedRisky - predictedBlocked);
  const riskLevel = derivePredictRiskLevel(items);
  const prediction = derivePrediction(items, riskLevel);
  const confidence = deriveConfidence(items, riskLevel);
  const summary = buildSummary(items, predictedSafe, predictedRisky, predictedBlocked);
  const recommendedAction = buildRecommendedAction(riskLevel, predictedBlocked, predictedRisky);
  const nextCommands = buildNextCommands(options, riskLevel, predictedBlocked > 0);
  const highestRiskChanges = [...items]
    .sort(comparePredictItem)
    .slice(0, options.packageName ? 1 : 3);

  return {
    scope: options.packageName
      ? "package"
      : options.fromPlanFile
        ? "plan"
        : "workspace",
    packageName: options.packageName,
    fromPlanFile: options.fromPlanFile,
    prediction,
    riskLevel,
    confidence,
    checkedInMs: Date.now() - startedAt,
    analyzed: items.length,
    predictedSafe,
    predictedRisky,
    predictedBlocked,
    summary,
    highestRiskChanges,
    recommendedAction,
    nextCommands,
    warnings,
    errors,
  };
}

export function renderPredictResult(
  result: PredictResult,
  format: PredictOptions["format"],
): string {
  if (format === "minimal") {
    return `Prediction: ${result.prediction} | Risk: ${result.riskLevel} | Confidence: ${result.confidence}%`;
  }

  const scopeLabel = result.scope === "package"
    ? `Package: ${result.packageName}`
    : result.scope === "plan"
      ? `Input: decision plan (${result.fromPlanFile ?? "unknown"})`
      : "Scope: workspace";

  const lines = [
    "Rainy Updates Predict",
    "────────────────────────────────────────────────────────",
    scopeLabel,
    `Prediction: ${result.prediction}`,
    `Risk Level: ${result.riskLevel}`,
    `Confidence: ${result.confidence}%`,
    `Checked in: ${formatMs(result.checkedInMs)}`,
    "",
    "Prediction Summary",
    ...result.summary.map((entry) => `• ${entry}`),
  ];

  if (result.highestRiskChanges.length > 0) {
    lines.push("");
    lines.push("Highest-Risk Changes");
    result.highestRiskChanges.forEach((item, index) => {
      lines.push(
        `${index + 1}. ${item.packageName} ${item.fromVersion} -> ${item.toVersion} (${item.diffType})`,
      );
      lines.push(
        `   Risk: ${item.riskLevel ?? "unknown"}${typeof item.riskScore === "number" ? ` (score ${item.riskScore})` : ""}`,
      );
      if (item.reasons[0]) {
        lines.push(`   Reason: ${item.reasons[0]}`);
      }
    });
  }

  lines.push("");
  lines.push("Recommended Action");
  result.recommendedAction.forEach((entry) => lines.push(`• ${entry}`));
  lines.push("");
  lines.push("Next Commands");
  result.nextCommands.forEach((command) => lines.push(`› ${command}`));

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings");
    result.warnings.forEach((warning) => lines.push(`• ${warning}`));
  }

  if (result.errors.length > 0) {
    lines.push("");
    lines.push("Errors");
    result.errors.forEach((error) => lines.push(`• ${error}`));
  }

  return lines.join("\n");
}

async function readItemsFromReview(
  options: PredictOptions,
  warnings: string[],
  errors: string[],
): Promise<PredictItem[]> {
  const reviewOptions: ReviewOptions = {
    cwd: options.cwd,
    target: "latest",
    filter: options.packageName,
    reject: undefined,
    cacheTtlSeconds: options.cacheTtlSeconds,
    includeKinds: [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ],
    ci: false,
    format: "table",
    workspace: options.workspace,
    jsonFile: undefined,
    githubOutputFile: undefined,
    sarifFile: undefined,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
    registryRetries: options.registryRetries,
    offline: false,
    stream: false,
    policyFile: undefined,
    prReportFile: undefined,
    failOn: "none",
    maxUpdates: undefined,
    fixPr: false,
    fixBranch: "chore/rainy-updates",
    fixCommitMessage: undefined,
    fixDryRun: false,
    fixPrNoCheckout: false,
    fixPrBatchSize: undefined,
    noPrReport: true,
    logLevel: "info",
    groupBy: "none",
    groupMax: undefined,
    cooldownDays: undefined,
    prLimit: undefined,
    onlyChanged: false,
    affected: false,
    staged: false,
    baseRef: undefined,
    headRef: undefined,
    sinceRef: undefined,
    ciProfile: "minimal",
    lockfileMode: "preserve",
    interactive: false,
    showImpact: true,
    showHomepage: false,
    securityOnly: false,
    risk: undefined,
    diff: undefined,
    applySelected: false,
    showChangelog: options.includeChangelog,
    decisionPlanFile: undefined,
    queueFocus: "all",
    verify: "none",
    testCommand: undefined,
    verificationReportFile: undefined,
    ciGate: "check",
  };

  const review = await buildReviewResult(reviewOptions);
  warnings.push(...review.warnings);
  errors.push(...review.errors);
  return review.items.map((item) => ({
    packageName: item.update.name,
    packagePath: item.update.packagePath,
    fromVersion: cleanVersion(item.update.fromRange),
    toVersion: item.update.toVersionResolved,
    diffType: item.update.diffType,
    riskLevel: item.update.riskLevel,
    riskScore: item.update.riskScore,
    decisionState: item.update.decisionState,
    policyAction: item.update.policyAction,
    advisories: item.advisories.length,
    peerConflicts: item.peerConflicts.length,
    reasons: [
      ...(item.update.riskReasons ?? []),
      ...(item.peerConflicts.slice(0, 1).map((conflict) => conflict.suggestion ?? "Peer pressure detected.")),
      ...(item.advisories.slice(0, 1).map((advisory) => advisory.title)),
    ],
  }));
}

async function readItemsFromPlan(filePath: string, warnings: string[]): Promise<PredictItem[]> {
  const plan = await readDecisionPlan(filePath);
  const selected = plan.items.filter((item) => item.selected);
  if (selected.length === 0) {
    warnings.push("Decision plan has zero selected items.");
  }
  return selected.map((item) => ({
    packageName: item.name,
    packagePath: item.packagePath,
    fromVersion: cleanVersion(item.fromRange),
    toVersion: item.toVersionResolved,
    diffType: item.diffType,
    riskLevel: item.riskLevel,
    riskScore: item.riskScore,
    decisionState: item.decisionState,
    policyAction: item.policyAction,
    advisories: 0,
    peerConflicts: 0,
    reasons: [
      item.diffType === "major" ? "Major version upgrade in approved plan." : "",
      item.policyAction === "block" ? "Package policy blocks automatic upgrade." : "",
    ].filter(Boolean),
  }));
}

function derivePrediction(
  items: PredictItem[],
  riskLevel: PredictRiskLevel,
): PredictVerdict {
  if (items.some((item) => item.policyAction === "block")) return "Blocked by Policy";
  if (riskLevel === "High" || riskLevel === "Severe") return "Risky Upgrade";
  if (riskLevel === "Moderate") return "Review Recommended";
  return "Safe Upgrade";
}

function derivePredictRiskLevel(items: PredictItem[]): PredictRiskLevel {
  if (items.some((item) => item.policyAction === "block" || item.riskLevel === "critical")) {
    return "Severe";
  }
  if (items.some((item) => item.advisories > 0 || item.riskLevel === "high" || item.peerConflicts > 0)) {
    return "High";
  }
  if (items.some((item) => item.diffType === "major" || item.riskLevel === "medium")) {
    return "Moderate";
  }
  return "Low";
}

function deriveConfidence(items: PredictItem[], riskLevel: PredictRiskLevel): number {
  if (items.length === 0) return 55;
  let confidence = 70;
  if (items.some((item) => typeof item.riskScore === "number")) confidence += 8;
  if (items.some((item) => item.advisories > 0)) confidence += 6;
  if (items.some((item) => item.peerConflicts > 0)) confidence += 4;
  if (items.length > 12) confidence += 2;
  if (riskLevel === "Low") confidence += 3;
  if (riskLevel === "Severe") confidence -= 4;
  return Math.max(50, Math.min(96, confidence));
}

function buildSummary(
  items: PredictItem[],
  predictedSafe: number,
  predictedRisky: number,
  predictedBlocked: number,
): string[] {
  return [
    `${predictedSafe} update${predictedSafe === 1 ? "" : "s"} appear safe to group and apply`,
    `${predictedRisky} update${predictedRisky === 1 ? "" : "s"} need review`,
    `${predictedBlocked} update${predictedBlocked === 1 ? "" : "s"} blocked by policy`,
    `${items.filter((item) => item.peerConflicts > 0).length} update${items.filter((item) => item.peerConflicts > 0).length === 1 ? "" : "s"} may trigger peer conflicts`,
  ];
}

function buildRecommendedAction(
  riskLevel: PredictRiskLevel,
  blockedCount: number,
  riskyCount: number,
): string[] {
  if (riskLevel === "Severe" || blockedCount > 0) {
    return [
      "Do not apply broad upgrades automatically.",
      "Resolve blocked or critical-risk updates first.",
      "Isolate major updates and verify with tests.",
    ];
  }
  if (riskLevel === "High" || riskyCount > 0) {
    return [
      "Apply safe patch/minor updates first.",
      "Review risky updates separately before merge.",
      "Run install and test verification on the full plan.",
    ];
  }
  if (riskLevel === "Moderate") {
    return [
      "Group routine updates and keep majors isolated.",
      "Use review mode for medium-risk changes.",
    ];
  }
  return [
    "Safe to include in routine upgrade batches.",
    "Keep verification enabled in CI for confidence.",
  ];
}

function buildNextCommands(
  options: PredictOptions,
  riskLevel: PredictRiskLevel,
  blocked: boolean,
): string[] {
  if (options.fromPlanFile) {
    return [
      `rup upgrade --from-plan ${options.fromPlanFile} --verify install,test --test-command "bun test"`,
      "rup audit --severity high",
      `rup snapshot save --label "pre-plan-${Date.now()}"`,
    ];
  }
  if (options.packageName) {
    return riskLevel === "Low"
      ? [
          "rup review",
          "rup upgrade --target minor",
        ]
      : [
          "rup review --risk high --diff major",
          `rup explain ${options.packageName}`,
          `rup bisect ${options.packageName} --cmd "bun test"`,
        ];
  }
  if (blocked || riskLevel === "High" || riskLevel === "Severe") {
    return [
      "rup snapshot save --label \"pre-risky-upgrade\"",
      "rup review --risk high --diff major",
      "rup upgrade --verify install,test --test-command \"bun test\"",
    ];
  }
  return [
    "rup review",
    "rup upgrade --target minor",
    "rup audit --severity high",
  ];
}

function isRiskyItem(item: PredictItem): boolean {
  return (
    item.policyAction === "block" ||
    item.advisories > 0 ||
    item.peerConflicts > 0 ||
    item.diffType === "major" ||
    item.riskLevel === "critical" ||
    item.riskLevel === "high"
  );
}

function comparePredictItem(left: PredictItem, right: PredictItem): number {
  const leftWeight = riskWeight(left);
  const rightWeight = riskWeight(right);
  if (leftWeight !== rightWeight) return rightWeight - leftWeight;
  return left.packageName.localeCompare(right.packageName);
}

function riskWeight(item: PredictItem): number {
  const riskLevelWeight = {
    critical: 8,
    high: 6,
    medium: 4,
    low: 2,
  } as const;
  return (
    (item.policyAction === "block" ? 10 : 0) +
    (item.advisories > 0 ? 5 : 0) +
    (item.peerConflicts > 0 ? 4 : 0) +
    (item.diffType === "major" ? 3 : 0) +
    riskLevelWeight[item.riskLevel ?? "low"] +
    (item.riskScore ?? 0) / 25
  );
}

function cleanVersion(value: string): string {
  const parsed = parseVersion(value.replace(/^[~^><= ]+/, ""));
  return parsed ? `${parsed.major}.${parsed.minor}.${parsed.patch}` : value;
}

function formatMs(value: number): string {
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}
