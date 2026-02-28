import type {
  AuditOptions,
  AuditSourceMode,
  AuditSourceName,
  CveAdvisory,
} from "../../../types/index.js";
import { compareVersions, parseVersion } from "../../../utils/semver.js";
import type { AuditTarget } from "../targets.js";
import { githubAuditSource } from "./github.js";
import { osvAuditSource } from "./osv.js";
import type { AuditSourceAdapter, AuditSourceFetchResult } from "./types.js";

const SOURCE_MAP: Record<AuditSourceName, AuditSourceAdapter> = {
  osv: osvAuditSource,
  github: githubAuditSource,
};

export async function fetchAdvisoriesFromSources(
  targets: AuditTarget[],
  options: Pick<AuditOptions, "concurrency" | "registryTimeoutMs" | "sourceMode">,
): Promise<AuditSourceFetchResult & { sourcesUsed: AuditSourceName[] }> {
  const selected = selectSources(options.sourceMode);
  const results = await Promise.all(
    selected.map((name) => SOURCE_MAP[name].fetch(targets, options)),
  );

  const warnings = results.flatMap((result) => result.warnings);
  const merged = mergeAdvisories(results.flatMap((result) => result.advisories));

  return {
    advisories: merged,
    warnings,
    sourcesUsed: selected,
  };
}

function selectSources(mode: AuditSourceMode): AuditSourceName[] {
  if (mode === "osv") return ["osv"];
  if (mode === "github") return ["github"];
  return ["osv", "github"];
}

function mergeAdvisories(advisories: CveAdvisory[]): CveAdvisory[] {
  const merged = new Map<string, CveAdvisory>();

  for (const advisory of advisories) {
    const key = [
      advisory.packageName,
      advisory.currentVersion ?? "?",
      advisory.cveId,
    ].join("|");
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, advisory);
      continue;
    }

    merged.set(key, {
      ...existing,
      severity:
        severityRank(advisory.severity) > severityRank(existing.severity)
          ? advisory.severity
          : existing.severity,
      vulnerableRange:
        existing.vulnerableRange === "*" && advisory.vulnerableRange !== "*"
          ? advisory.vulnerableRange
          : existing.vulnerableRange,
      patchedVersion: choosePreferredPatch(existing.patchedVersion, advisory.patchedVersion),
      title: existing.title.length >= advisory.title.length ? existing.title : advisory.title,
      url: existing.url.length >= advisory.url.length ? existing.url : advisory.url,
      sources: [...new Set([...existing.sources, ...advisory.sources])].sort(),
    });
  }

  return [...merged.values()];
}

function choosePreferredPatch(
  current: string | null,
  next: string | null,
): string | null {
  if (!current) return next;
  if (!next) return current;
  const currentParsed = parseVersion(current);
  const nextParsed = parseVersion(next);
  if (currentParsed && nextParsed) {
    return compareVersions(currentParsed, nextParsed) <= 0 ? current : next;
  }
  return current <= next ? current : next;
}

function severityRank(value: CveAdvisory["severity"]): number {
  if (value === "critical") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}
