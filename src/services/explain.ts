import { buildReviewResult } from "../core/review-model.js";
import { parseVersion } from "../utils/semver.js";
import type {
  ExplainOptions,
  ExplainResult,
  ReviewOptions,
  ServiceContext,
} from "../types/index.js";

export async function runExplainService(
  options: ExplainOptions,
  _context?: ServiceContext,
): Promise<ExplainResult> {
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
    showHomepage: true,
    securityOnly: false,
    risk: undefined,
    diff: undefined,
    applySelected: false,
    showChangelog: true,
    decisionPlanFile: undefined,
    queueFocus: "all",
    verify: "none",
    testCommand: undefined,
    verificationReportFile: undefined,
    ciGate: "check",
  };

  const review = await buildReviewResult(reviewOptions);
  const item = review.items.find((entry) => entry.update.name === options.packageName);

  if (!item) {
    throw new Error(`No update context found for package "${options.packageName}".`);
  }

  const fromVersion = options.fromVersion ?? cleanVersion(item.update.fromRange);
  const toVersion = options.toVersion ?? item.update.toVersionResolved;
  const breakingSignals: string[] = [];

  if (item.update.diffType === "major") {
    breakingSignals.push("Major version change detected.");
  }
  if (item.peerConflicts.length > 0) {
    breakingSignals.push(
      `${item.peerConflicts.length} peer dependency conflict(s) require review.`,
    );
  }
  if (item.update.engineStatus?.state === "blocked") {
    breakingSignals.push(item.update.engineStatus.reason ?? "Engine constraint is blocked.");
  }

  return {
    packageName: item.update.name,
    fromVersion,
    toVersion,
    diffType: item.update.diffType,
    riskLevel: item.update.riskLevel,
    riskScore: item.update.riskScore,
    securityFindings: item.advisories.map((advisory) => ({
      cveId: advisory.cveId,
      severity: advisory.severity,
      title: advisory.title,
      url: advisory.url,
      patchedVersion: advisory.patchedVersion,
    })),
    releaseNotes: item.update.releaseNotesSummary
      ? {
          source: item.update.releaseNotesSummary.source,
          title: item.update.releaseNotesSummary.title,
          excerpt: item.update.releaseNotesSummary.excerpt,
        }
      : undefined,
    breakingSignals,
    recommendedAction:
      item.update.recommendedAction ??
      (item.advisories.length > 0
        ? "Upgrade promptly because this update includes security fixes."
        : item.update.diffType === "patch"
          ? "Safe to upgrade."
          : "Review changelog and compatibility before upgrading."),
    errors: review.errors,
    warnings: review.warnings,
  };
}

export function renderExplainResult(
  result: ExplainResult,
  format: ExplainOptions["format"],
): string {
  if (format === "minimal") {
    return `${result.packageName} ${result.fromVersion} -> ${result.toVersion} | ${result.diffType} | ${result.riskLevel ?? "unknown"} | ${result.recommendedAction}`;
  }

  const lines = [
    `${result.packageName}  ${result.fromVersion} -> ${result.toVersion}`,
    `Risk: ${result.riskLevel?.toUpperCase() ?? "UNKNOWN"} | Type: ${result.diffType} | Score: ${result.riskScore ?? "n/a"}`,
  ];

  if (result.securityFindings.length > 0) {
    for (const finding of result.securityFindings) {
      lines.push(
        `- ${finding.cveId}: ${finding.title} (${finding.severity}${finding.patchedVersion ? `, patched in ${finding.patchedVersion}` : ""})`,
      );
    }
  } else {
    lines.push("- No security advisories found in current review context.");
  }

  if (result.releaseNotes) {
    lines.push(`- Release notes: ${result.releaseNotes.title} — ${result.releaseNotes.excerpt}`);
  }

  if (result.breakingSignals.length > 0) {
    for (const signal of result.breakingSignals) {
      lines.push(`- Breaking signal: ${signal}`);
    }
  } else {
    lines.push("- No explicit breaking signals detected.");
  }

  lines.push(`Recommended: ${result.recommendedAction}`);
  return lines.join("\n");
}

function cleanVersion(value: string): string {
  const parsed = parseVersion(value.replace(/^[~^><= ]+/, ""));
  return parsed ? `${parsed.major}.${parsed.minor}.${parsed.patch}` : value;
}
