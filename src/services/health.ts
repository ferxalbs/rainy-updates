import {
  collectDependencies,
  readManifest,
} from "../parsers/package-json.js";
import { discoverPackageDirs } from "../workspace/discover.js";
import { asyncPool } from "../utils/async-pool.js";
import type {
  HealthFlag,
  HealthOptions,
  HealthResult,
  PackageHealthMetric,
  ServiceContext,
} from "../types/index.js";
import { emitServiceEvent } from "./context.js";

interface NpmPackageMetadata {
  deprecated?: string;
  time?: Record<string, string>;
}

async function fetchNpmMeta(
  packageName: string,
  timeoutMs: number,
): Promise<NpmPackageMetadata> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/vnd.npm.install-v1+json" },
      },
    );
    clearTimeout(timer);
    if (!response.ok) return {};
    return (await response.json()) as NpmPackageMetadata;
  } catch {
    return {};
  }
}

function analyzePackage(
  name: string,
  currentVersion: string,
  meta: NpmPackageMetadata,
  options: HealthOptions,
): PackageHealthMetric {
  const flags: HealthFlag[] = [];
  const isDeprecated =
    typeof meta.deprecated === "string" && meta.deprecated.length > 0;
  const now = Date.now();

  let lastPublished: string | null = null;
  let daysSinceLastRelease: number | null = null;

  if (meta.time) {
    const releaseTimes = Object.entries(meta.time)
      .filter(([k]) => k !== "created" && k !== "modified")
      .map(([, v]) => new Date(v).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => b - a);

    if (releaseTimes[0]) {
      lastPublished = new Date(releaseTimes[0]).toISOString().slice(0, 10);
      daysSinceLastRelease = Math.floor(
        (now - releaseTimes[0]) / (1000 * 60 * 60 * 24),
      );
    }
  }

  if (isDeprecated && options.includeDeprecated) flags.push("deprecated");
  if (daysSinceLastRelease !== null && daysSinceLastRelease > options.staleDays) {
    flags.push("stale");
  }
  if (
    daysSinceLastRelease !== null &&
    daysSinceLastRelease > options.staleDays * 2
  ) {
    flags.push("unmaintained");
  }

  return {
    name,
    currentVersion,
    lastPublished,
    isDeprecated,
    deprecatedMessage: isDeprecated ? meta.deprecated : undefined,
    isArchived: false,
    daysSinceLastRelease,
    flags,
  };
}

export function renderHealthTable(metrics: PackageHealthMetric[]): string {
  const flagged = metrics.filter((m) => m.flags.length > 0);
  if (flagged.length === 0) return "✔ All packages appear healthy.\n";

  const lines: string[] = [
    `Found ${flagged.length} package${flagged.length === 1 ? "" : "s"} with health concerns:\n`,
    "Package".padEnd(30) +
      "Flags".padEnd(25) +
      "Last Release".padEnd(15) +
      "Message",
    "─".repeat(90),
  ];

  for (const metric of flagged) {
    const name = metric.name.slice(0, 28).padEnd(30);
    const flags = metric.flags.join(", ").padEnd(25);
    const lastRel = (metric.lastPublished ?? "unknown").padEnd(15);
    const msg =
      metric.deprecatedMessage ??
      (metric.daysSinceLastRelease !== null
        ? `${metric.daysSinceLastRelease}d ago`
        : "");
    lines.push(`${name}${flags}${lastRel}${msg}`);
  }

  return lines.join("\n");
}

export async function runHealthService(
  options: HealthOptions,
  context?: ServiceContext,
): Promise<HealthResult> {
  const result: HealthResult = {
    metrics: [],
    totalFlagged: 0,
    errors: [],
    warnings: [],
  };

  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace, {
    git: options,
    includeKinds: ["dependencies", "devDependencies", "optionalDependencies"],
    includeDependents: options.affected === true,
  });
  const versionMap = new Map<string, string>();

  for (const dir of packageDirs) {
    try {
      const manifest = await readManifest(dir);
      const deps = collectDependencies(manifest, [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
      ]);
      for (const dep of deps) {
        if (!versionMap.has(dep.name)) {
          versionMap.set(dep.name, dep.range.replace(/^[\^~>=<]/, ""));
        }
      }
    } catch (error) {
      result.errors.push(`Failed to read package.json in ${dir}: ${String(error)}`);
    }
  }

  const entries = [...versionMap.entries()];
  emitServiceEvent(context, {
    level: "info",
    message: `[health] Analyzing ${entries.length} packages`,
  });

  const tasks = entries.map(
    ([name, version]): (() => Promise<PackageHealthMetric>) => async () => {
      const meta = await fetchNpmMeta(name, options.registryTimeoutMs);
      return analyzePackage(name, version, meta, options);
    },
  );

  const rawResults = await asyncPool<PackageHealthMetric>(
    options.concurrency,
    tasks,
  );
  result.metrics = rawResults
    .filter((entry): entry is PackageHealthMetric => !(entry instanceof Error))
    .sort((a, b) => (b.daysSinceLastRelease ?? 0) - (a.daysSinceLastRelease ?? 0));
  result.totalFlagged = result.metrics.filter((metric) => metric.flags.length > 0).length;

  return result;
}
