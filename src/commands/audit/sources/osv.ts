import type { AuditOptions, CveAdvisory } from "../../../types/index.js";
import { asyncPool } from "../../../utils/async-pool.js";
import type {
  AuditSourceAdapter,
  AuditSourceTargetResult,
} from "./types.js";
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
      (target): (() => Promise<AuditSourceTargetResult>) =>
        () => queryOsv(target, options.registryTimeoutMs),
    );

    const results = await asyncPool<AuditSourceTargetResult>(
      options.concurrency,
      tasks,
    );
    const advisories: CveAdvisory[] = [];
    let successfulTargets = 0;
    let failedTargets = 0;
    const errorCounts = new Map<string, number>();
    for (const result of results) {
      if (result instanceof Error) {
        failedTargets += 1;
        incrementCount(errorCounts, "internal-error");
        continue;
      }
      advisories.push(...result.advisories);
      if (result.ok) {
        successfulTargets += 1;
      } else {
        failedTargets += 1;
        incrementCount(errorCounts, result.error ?? "request-failed");
      }
    }

    const status =
      failedTargets === 0
        ? "ok"
        : successfulTargets === 0
          ? "failed"
          : "partial";

    return {
      advisories,
      warnings: createSourceWarnings("OSV.dev", targets.length, successfulTargets, failedTargets),
      health: {
        source: "osv",
        status,
        attemptedTargets: targets.length,
        successfulTargets,
        failedTargets,
        advisoriesFound: advisories.length,
        message: formatDominantError(errorCounts),
      },
    };
  },
};

async function queryOsv(
  target: AuditTarget,
  timeoutMs: number,
): Promise<AuditSourceTargetResult> {
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
  } catch (error) {
    return { advisories: [], ok: false, error: classifyFetchError(error) };
  }

  if (!response.ok) {
    return { advisories: [], ok: false, error: `http-${response.status}` };
  }

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

  return { advisories, ok: true };
}

function createSourceWarnings(
  label: string,
  attemptedTargets: number,
  successfulTargets: number,
  failedTargets: number,
): string[] {
  if (failedTargets === 0) return [];
  if (successfulTargets === 0) {
    return [
      `${label} unavailable for all ${attemptedTargets} audit target${attemptedTargets === 1 ? "" : "s"}.`,
    ];
  }
  return [
    `${label} partially unavailable: ${failedTargets}/${attemptedTargets} audit target${attemptedTargets === 1 ? "" : "s"} failed.`,
  ];
}

function classifyFetchError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "timeout";
  return "network";
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatDominantError(errorCounts: Map<string, number>): string | undefined {
  const sorted = [...errorCounts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0];
}
