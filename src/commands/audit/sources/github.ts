import type { AuditOptions, AuditSeverity, CveAdvisory } from "../../../types/index.js";
import { asyncPool } from "../../../utils/async-pool.js";
import type { AuditSourceAdapter } from "./types.js";
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
      (target): (() => Promise<CveAdvisory[]>) =>
        () => queryGitHub(target, options.registryTimeoutMs),
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

async function queryGitHub(
  target: AuditTarget,
  timeoutMs: number,
): Promise<CveAdvisory[]> {
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
  } catch {
    return [];
  }

  if (!response.ok) return [];

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

  return advisories;
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
