import type { CveAdvisory, AuditOptions } from "../../types/index.js";
import { asyncPool } from "../../utils/async-pool.js";

const OSV_API = "https://api.osv.dev/v1/query";
const GITHUB_ADVISORY_API = "https://api.github.com/advisories";

interface OsvResponse {
  vulns?: Array<{
    id: string;
    summary?: string;
    database_specific?: { severity?: string };
    affected?: Array<{
      package?: { name: string; ecosystem: string };
      ranges?: Array<{
        type: string;
        events?: Array<{ introduced?: string; fixed?: string }>;
      }>;
      versions?: string[];
    }>;
    references?: Array<{ url: string }>;
  }>;
}

interface AuditTarget {
  name: string;
  version: string;
}

export function extractAuditVersion(range: string): string | null {
  const trimmed = range.trim();
  const match = trimmed.match(
    /^(?:\^|~|>=|<=|>|<|=)?\s*(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/,
  );
  return match?.[1] ?? null;
}

/**
 * Queries OSV.dev for advisories for a single npm package/version pair.
 */
async function queryOsv(
  target: AuditTarget,
  timeoutMs: number,
): Promise<CveAdvisory[]> {
  const body = JSON.stringify({
    package: { name: target.name, ecosystem: "npm" },
    version: target.version,
  });

  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    response = await fetch(OSV_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const data = (await response.json()) as OsvResponse;
  const advisories: CveAdvisory[] = [];

  for (const vuln of data.vulns ?? []) {
    const cveId = vuln.id ?? "UNKNOWN";
    const rawSeverity = (
      vuln.database_specific?.severity ?? "medium"
    ).toLowerCase();
    const severity = (
      ["critical", "high", "medium", "low"].includes(rawSeverity)
        ? rawSeverity
        : "medium"
    ) as CveAdvisory["severity"];

    let patchedVersion: string | null = null;
    let vulnerableRange = "*";

    for (const affected of vuln.affected ?? []) {
      if (affected.package?.name !== target.name) continue;
      for (const range of affected.ranges ?? []) {
        const fixedEvent = range.events?.find((e) => e.fixed);
        if (fixedEvent?.fixed) {
          patchedVersion = fixedEvent.fixed;
          const introducedEvent = range.events?.find((e) => e.introduced);
          vulnerableRange = introducedEvent?.introduced
            ? `>=${introducedEvent.introduced} <${patchedVersion}`
            : `<${patchedVersion}`;
        }
      }
    }

    advisories.push({
      cveId,
      packageName: target.name,
      currentVersion: target.version,
      severity,
      vulnerableRange,
      patchedVersion,
      title: vuln.summary ?? cveId,
      url:
        vuln.references?.[0]?.url ?? `https://osv.dev/vulnerability/${cveId}`,
    });
  }

  return advisories;
}

/**
 * Fetches CVE advisories for all given package names in parallel.
 * Uses OSV.dev as primary source.
 */
export async function fetchAdvisories(
  targets: AuditTarget[],
  options: Pick<AuditOptions, "concurrency" | "registryTimeoutMs">,
): Promise<CveAdvisory[]> {
  const tasks = targets.map(
    (target): (() => Promise<CveAdvisory[]>) =>
      () =>
        queryOsv(target, options.registryTimeoutMs),
  );
  const results = await asyncPool<CveAdvisory[]>(options.concurrency, tasks);
  const advisories: CveAdvisory[] = [];
  for (const r of results) {
    if (!(r instanceof Error)) {
      for (const adv of r) advisories.push(adv);
    }
  }
  return advisories;
}
