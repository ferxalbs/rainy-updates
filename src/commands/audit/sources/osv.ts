import type { AuditOptions, CveAdvisory } from "../../../types/index.js";
import { asyncPool } from "../../../utils/async-pool.js";
import type { AuditSourceAdapter, AuditSourceFetchResult } from "./types.js";
import type { AuditTarget } from "../targets.js";

const OSV_API = "https://api.osv.dev/v1/query";

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
    }>;
    references?: Array<{ url: string }>;
  }>;
}

export const osvAuditSource: AuditSourceAdapter = {
  name: "osv",
  async fetch(targets, options) {
    const tasks = targets.map(
      (target): (() => Promise<CveAdvisory[]>) =>
        () => queryOsv(target, options.registryTimeoutMs),
    );

    const results = await asyncPool<CveAdvisory[]>(options.concurrency, tasks);
    const advisories: CveAdvisory[] = [];
    for (const result of results) {
      if (result instanceof Error) continue;
      advisories.push(...result);
    }

    return { advisories, warnings: [] };
  },
};

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
        const fixedEvent = range.events?.find((event) => event.fixed);
        if (fixedEvent?.fixed) {
          patchedVersion = fixedEvent.fixed;
          const introducedEvent = range.events?.find((event) => event.introduced);
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
      sources: ["osv"],
    });
  }

  return advisories;
}
