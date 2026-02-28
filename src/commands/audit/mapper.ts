import type {
  AuditPackageSummary,
  CveAdvisory,
  AuditSeverity,
} from "../../types/index.js";
import { compareVersions, parseVersion, satisfies } from "../../utils/semver.js";

const SEVERITY_RANK: Record<AuditSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Filters advisories by minimum severity level.
 * e.g. --severity high → keeps critical and high.
 */
export function filterBySeverity(
  advisories: CveAdvisory[],
  minSeverity: AuditSeverity | undefined,
): CveAdvisory[] {
  if (!minSeverity) return advisories;
  const minRank = SEVERITY_RANK[minSeverity];
  return advisories.filter((a) => SEVERITY_RANK[a.severity] >= minRank);
}

/**
 * For each advisory that has a known patchedVersion,
 * produces a sorted, deduplicated map of package → minimum secure version.
 * Used by --fix to determine what version to update to.
 *
 * Uses proper semver numeric comparison — NOT string comparison — so that
 * e.g. "5.19.1" correctly beats "5.5.1" (lexicographically "5.5.1" > "5.19.1"
 * because "5" > "1" at the third character, which is the classic semver trap).
 */
export function buildPatchMap(advisories: CveAdvisory[]): Map<string, string> {
  const patchMap = new Map<string, string>();
  const byPackage = new Map<string, CveAdvisory[]>();

  for (const advisory of advisories) {
    const items = byPackage.get(advisory.packageName) ?? [];
    items.push(advisory);
    byPackage.set(advisory.packageName, items);
  }

  for (const [packageName, items] of byPackage) {
    const candidates = [...new Set(items.flatMap((item) => item.patchedVersion ? [item.patchedVersion] : []))].sort(
      compareSemverAsc,
    );
    if (candidates.length === 0) continue;

    const safeCandidate = candidates.find((candidate) =>
      items.every((item) => !satisfies(candidate, item.vulnerableRange)),
    );

    patchMap.set(
      packageName,
      safeCandidate ?? candidates[candidates.length - 1]!,
    );
  }

  return patchMap;
}

function compareSemverAsc(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa && pb) return compareVersions(pa, pb);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function summarizeAdvisories(
  advisories: CveAdvisory[],
): AuditPackageSummary[] {
  const byPackage = new Map<string, CveAdvisory[]>();

  for (const advisory of advisories) {
    const key = `${advisory.packageName}|${advisory.currentVersion ?? "?"}`;
    const items = byPackage.get(key) ?? [];
    items.push(advisory);
    byPackage.set(key, items);
  }

  const summaries: AuditPackageSummary[] = [];
  for (const [, items] of byPackage) {
    const sorted = [...items].sort(
      (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
    );
    const representative = sorted[0]!;
    const patchMap = buildPatchMap(items);
    summaries.push({
      packageName: representative.packageName,
      currentVersion: representative.currentVersion,
      severity: representative.severity,
      advisoryCount: items.length,
      patchedVersion: patchMap.get(representative.packageName) ?? null,
      sources: [...new Set(items.flatMap((item) => item.sources))].sort(),
    });
  }

  return summaries.sort((a, b) => {
    const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.packageName.localeCompare(b.packageName);
  });
}

/**
 * Renders audit advisories as a formatted table string for terminal output.
 */
export function renderAuditTable(advisories: CveAdvisory[]): string {
  if (advisories.length === 0) {
    return "✔ No vulnerabilities found.\n";
  }

  const SEVERITY_ICON: Record<AuditSeverity, string> = {
    critical: "🔴 CRITICAL",
    high: "🟠 HIGH    ",
    medium: "🟡 MEDIUM  ",
    low: "⚪ LOW     ",
  };

  const sorted = [...advisories].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );

  const lines: string[] = [
    `Found ${advisories.length} ${advisories.length === 1 ? "vulnerability" : "vulnerabilities"}:\n`,
    "Package".padEnd(24) +
      "Current".padEnd(14) +
      "Severity".padEnd(20) +
      "CVE".padEnd(22) +
      "Patch",
    "─".repeat(104),
  ];

  for (const adv of sorted) {
    const name = adv.packageName.slice(0, 22).padEnd(24);
    const current = (adv.currentVersion ?? "?").slice(0, 12).padEnd(14);
    const sev = SEVERITY_ICON[adv.severity].padEnd(20);
    const cve = adv.cveId.slice(0, 20).padEnd(22);
    const patch = adv.patchedVersion ? `→ ${adv.patchedVersion}` : "no patch";
    lines.push(`${name}${current}${sev}${cve}${patch}`);
  }

  return lines.join("\n");
}

export function renderAuditSummary(packages: AuditPackageSummary[]): string {
  if (packages.length === 0) {
    return "✔ No vulnerable packages found.\n";
  }

  const SEVERITY_ICON: Record<AuditSeverity, string> = {
    critical: "🔴 CRITICAL",
    high: "🟠 HIGH    ",
    medium: "🟡 MEDIUM  ",
    low: "⚪ LOW     ",
  };

  const lines: string[] = [
    `Found ${packages.length} affected ${packages.length === 1 ? "package" : "packages"}:\n`,
    "Package".padEnd(24) +
      "Current".padEnd(14) +
      "Severity".padEnd(20) +
      "Advisories".padEnd(12) +
      "Patch",
    "─".repeat(98),
  ];

  for (const item of packages) {
    const name = item.packageName.slice(0, 22).padEnd(24);
    const current = (item.currentVersion ?? "?").slice(0, 12).padEnd(14);
    const sev = SEVERITY_ICON[item.severity].padEnd(20);
    const count = String(item.advisoryCount).padEnd(12);
    const patch = item.patchedVersion ? `→ ${item.patchedVersion}` : "no patch";
    lines.push(`${name}${current}${sev}${count}${patch}`);
  }

  return lines.join("\n");
}
