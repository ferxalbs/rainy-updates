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

/**
 * Queries OSV.dev for advisories for a single npm package.
 */
async function queryOsv(
  packageName: string,
  timeoutMs: number,
): Promise<CveAdvisory[]> {
  const body = JSON.stringify({
    package: { name: packageName, ecosystem: "npm" },
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
      if (affected.package?.name !== packageName) continue;
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
      packageName,
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
  packageNames: string[],
  options: Pick<AuditOptions, "concurrency" | "registryTimeoutMs">,
): Promise<CveAdvisory[]> {
  const tasks = packageNames.map(
    (name): (() => Promise<CveAdvisory[]>) =>
      () =>
        queryOsv(name, options.registryTimeoutMs),
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
