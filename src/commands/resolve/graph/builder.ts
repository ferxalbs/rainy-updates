import { asyncPool } from "../../../utils/async-pool.js";
import { VersionCache } from "../../../cache/cache.js";
import { NpmRegistryClient } from "../../../registry/npm.js";
import {
  readManifest,
  collectDependencies,
} from "../../../parsers/package-json.js";
import { discoverPackageDirs } from "../../../workspace/discover.js";
import type {
  PeerGraph,
  PeerNode,
  ResolveOptions,
} from "../../../types/index.js";

interface PeerPackageMetadata {
  resolvedVersion: string;
  peerRequirements: Map<string, string>;
}

/**
 * Builds an in-memory PeerGraph from the direct dependencies declared in
 * package.json, enriched with peerDependency ranges fetched from the registry.
 *
 * Performance strategy:
 *   - Collect all unique package names first (single pass)
 *   - Check cache for packument data (zero network cost on cache hit)
 *   - Fetch missing ones via asyncPool (parallel, up to options.concurrency)
 *   - Build PeerGraph from merged results
 *
 * The graph only contains packages that declare peerDependencies — packages
 * without peers are implicitly conflict-free and excluded to keep the graph lean.
 */
export async function buildPeerGraph(
  options: ResolveOptions,
  /**
   * Optional override of the resolved versions map (used by --after-update mode
   * to inject proposed upgrade versions before writing them to disk).
   */
  resolvedVersionOverrides?: Map<string, string>,
): Promise<PeerGraph> {
  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace);
  const cache = await VersionCache.create();
  const registry = new NpmRegistryClient(options.cwd, {
    timeoutMs: options.registryTimeoutMs,
    retries: 2,
  });

  // ─ Step 1: collect all declared dependencies and their current versions ────
  const declaredVersions = new Map<string, string>(); // name → range/version
  const roots: string[] = [];

  for (const packageDir of packageDirs) {
    let manifest;
    try {
      manifest = await readManifest(packageDir);
    } catch {
      continue;
    }

    const deps = collectDependencies(manifest, [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ]);

    for (const dep of deps) {
      if (!declaredVersions.has(dep.name)) {
        // Strip range prefix to get a bare version for peer satisfaction checks
        const bare =
          dep.range.replace(/^[~^>=<]/, "").split(" ")[0] ?? dep.range;
        declaredVersions.set(dep.name, bare);
        roots.push(dep.name);
      }
    }
  }

  // Apply version overrides (--after-update mode)
  if (resolvedVersionOverrides) {
    for (const [name, version] of resolvedVersionOverrides) {
      declaredVersions.set(name, version);
    }
  }

  const packageNames = Array.from(declaredVersions.keys());

  // ─ Step 2: fetch peer dependency data ─────────────────────────────────────
  // Check cache first, then fetch missing ones from registry
  const peerDataByName = new Map<string, PeerPackageMetadata>();
  const uncached: string[] = [];

  for (const name of packageNames) {
    const cached = await cache.getAny(name, "latest");
    const resolvedVersion =
      resolvedVersionOverrides?.get(name) ??
      declaredVersions.get(name) ??
      "0.0.0";

    if (cached) {
      // We have cached packument; peer deps would need a separate field.
      // For now, initialize with empty peers (fetched below if needed).
      peerDataByName.set(name, {
        resolvedVersion,
        peerRequirements: new Map(),
      });
    } else {
      uncached.push(name);
    }
  }

  // Fetch peer deps for packages not in cache
  if (uncached.length > 0) {
    const fetched = await registry.resolveManyPackageMetadata(uncached, {
      concurrency: options.concurrency,
      timeoutMs: options.registryTimeoutMs,
      retries: 2,
    });

    for (const name of uncached) {
      const resolvedVersion =
        resolvedVersionOverrides?.get(name) ??
        declaredVersions.get(name) ??
        "0.0.0";
      peerDataByName.set(name, {
        resolvedVersion,
        peerRequirements: new Map(), // peer deps from packument handled below
      });
    }

    // The registry packument includes peerDependencies in the version object.
    // Fetch peer deps via a targeted per-package request for the resolved version.
    const peerFetchTasks = uncached.map((name) => async () => {
      const resolvedVersion =
        resolvedVersionOverrides?.get(name) ??
        declaredVersions.get(name) ??
        "0.0.0";
      const peerDeps = await fetchPeerDepsForVersion(
        name,
        resolvedVersion,
        options.registryTimeoutMs,
      );
      const existing = peerDataByName.get(name);
      if (existing) {
        existing.peerRequirements = peerDeps;
      }
    });

    await asyncPool<void>(options.concurrency, peerFetchTasks);
  }

  // Also fetch peer deps for cached packages where we don't have peer data
  const cachedPeerFetchTasks = packageNames
    .filter((n) => !uncached.includes(n))
    .map((name) => async () => {
      const resolvedVersion =
        resolvedVersionOverrides?.get(name) ??
        declaredVersions.get(name) ??
        "0.0.0";
      const peerDeps = await fetchPeerDepsForVersion(
        name,
        resolvedVersion,
        options.registryTimeoutMs,
      );
      const existing = peerDataByName.get(name);
      if (existing && peerDeps.size > 0) {
        existing.peerRequirements = peerDeps;
      }
    });

  await asyncPool<void>(options.concurrency, cachedPeerFetchTasks);

  // ─ Step 3: assemble PeerGraph ─────────────────────────────────────────────
  const nodes = new Map<string, PeerNode>();

  for (const [name, metadata] of peerDataByName) {
    if (metadata.peerRequirements.size > 0) {
      nodes.set(name, {
        name,
        resolvedVersion: metadata.resolvedVersion,
        peerRequirements: metadata.peerRequirements,
      });
    }
  }

  // Also add nodes that are referenced AS peers (so the resolver can look them up)
  for (const [, node] of nodes) {
    for (const [peerName] of node.peerRequirements) {
      if (!nodes.has(peerName) && declaredVersions.has(peerName)) {
        const meta = peerDataByName.get(peerName);
        nodes.set(peerName, {
          name: peerName,
          resolvedVersion:
            meta?.resolvedVersion ?? declaredVersions.get(peerName) ?? "0.0.0",
          peerRequirements: new Map(), // this node has no peer requirements of its own
        });
      }
    }
  }

  return { nodes, roots: [...new Set(roots)] };
}

/**
 * Fetches peerDependencies for a specific version of a package directly from
 * the npm registry packument. Returns an empty Map on any failure.
 */
async function fetchPeerDepsForVersion(
  packageName: string,
  version: string,
  timeoutMs: number,
): Promise<Map<string, string>> {
  const peerDeps = new Map<string, string>();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    clearTimeout(timer);
    if (!response.ok) return peerDeps;

    const packument = (await response.json()) as {
      versions?: Record<string, { peerDependencies?: Record<string, string> }>;
    };

    const versionData = packument.versions?.[version];
    if (!versionData?.peerDependencies) return peerDeps;

    for (const [peer, range] of Object.entries(versionData.peerDependencies)) {
      peerDeps.set(peer, range);
    }
  } catch {
    // Network/parse failure — return empty peer map (no false positives)
  }
  return peerDeps;
}
