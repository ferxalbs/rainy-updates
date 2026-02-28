import type { AuditOptions, AuditSeverity, CveAdvisory } from "../../../types/index.js";
import { asyncPool } from "../../../utils/async-pool.js";
import type {
  AuditSourceAdapter,
  AuditSourceTargetResult,
} from "./types.js";
import type { AuditTarget } from "../targets.js";

const GITHUB_ADVISORY_API = "https://api.github.com/advisories";

interface GitHubAdvisoryResponseItem {
  ghsa_id?: string;
  summary?: string;
  severity?: string;
  html_url?: string;
  cve_id?: string | null;
  vulnerabilities?: Array<{
    package?: { name?: string };
    vulnerable_version_range?: string;
    first_patched_version?: { identifier?: string | null } | null;
  }>;
}

export const githubAuditSource: AuditSourceAdapter = {
  name: "github",
  async fetch(targets, options) {
    const tasks = targets.map(
      (target): (() => Promise<AuditSourceTargetResult>) =>
        () => queryGitHub(target, options.registryTimeoutMs),
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
      warnings: createSourceWarnings(
        "GitHub Advisory DB",
        targets.length,
        successfulTargets,
        failedTargets,
      ),
      health: {
        source: "github",
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

async function queryGitHub(
  target: AuditTarget,
  timeoutMs: number,
): Promise<AuditSourceTargetResult> {
  const url = new URL(GITHUB_ADVISORY_API);
  url.searchParams.set("ecosystem", "npm");
  url.searchParams.set("affects", `${target.name}@${target.version}`);
  url.searchParams.set("per_page", "100");

  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "rainy-updates-cli",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (error) {
    return { advisories: [], ok: false, error: classifyFetchError(error) };
  }

  if (!response.ok) {
    return { advisories: [], ok: false, error: `http-${response.status}` };
  }

  const data = (await response.json()) as GitHubAdvisoryResponseItem[];
  const advisories: CveAdvisory[] = [];

  for (const item of data) {
    const vulnerability = item.vulnerabilities?.find(
      (entry) => entry.package?.name === target.name,
    );
    const severity = normalizeSeverity(item.severity);
    advisories.push({
      cveId: item.ghsa_id ?? item.cve_id ?? "UNKNOWN",
      packageName: target.name,
      currentVersion: target.version,
      severity,
      vulnerableRange: vulnerability?.vulnerable_version_range ?? "*",
      patchedVersion:
        vulnerability?.first_patched_version?.identifier?.trim() || null,
      title: item.summary ?? item.ghsa_id ?? "GitHub Advisory",
      url: item.html_url ?? `https://github.com/advisories/${item.ghsa_id}`,
      sources: ["github"],
    });
  }

  return { advisories, ok: true };
}

function normalizeSeverity(value: string | undefined): AuditSeverity {
  const normalized = (value ?? "medium").toLowerCase();
  if (
    normalized === "critical" ||
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low"
  ) {
    return normalized;
  }
  if (normalized === "moderate") return "medium";
  return "medium";
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
