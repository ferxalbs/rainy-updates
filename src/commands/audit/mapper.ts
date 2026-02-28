import type { CveAdvisory, AuditSeverity } from "../../types/index.js";

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

  for (const advisory of advisories) {
    if (!advisory.patchedVersion) continue;
    const existing = patchMap.get(advisory.packageName);
    if (!existing || semverGt(advisory.patchedVersion, existing)) {
      patchMap.set(advisory.packageName, advisory.patchedVersion);
    }
  }

  return patchMap;
}

/** Returns true if `a` is semantically greater than `b`. */
function semverGt(a: string, b: string): boolean {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return a > b; // fallback for non-standard versions
  if (pa[0] !== pb[0]) return pa[0] > pb[0];
  if (pa[1] !== pb[1]) return pa[1] > pb[1];
  return pa[2] > pb[2];
}

function parseSemver(v: string): [number, number, number] | null {
  const m = v.replace(/^[~^>=<]/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
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
    "Package".padEnd(30) + "Severity".padEnd(20) + "CVE".padEnd(22) + "Patch",
    "─".repeat(90),
  ];

  for (const adv of sorted) {
    const name = adv.packageName.slice(0, 28).padEnd(30);
    const sev = SEVERITY_ICON[adv.severity].padEnd(20);
    const cve = adv.cveId.slice(0, 20).padEnd(22);
    const patch = adv.patchedVersion ? `→ ${adv.patchedVersion}` : "no patch";
    lines.push(`${name}${sev}${cve}${patch}`);
  }

  return lines.join("\n");
}
