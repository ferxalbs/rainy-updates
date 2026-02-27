import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { asyncPool } from "../utils/async-pool.js";

const DEFAULT_TIMEOUT_MS = 8000;
const USER_AGENT = "@rainy-updates/cli";
const DEFAULT_REGISTRY = "https://registry.npmjs.org/";

type RequestLike = (packageName: string, timeoutMs: number) => Promise<{
  status: number;
  data: { "dist-tags"?: { latest?: string }; versions?: Record<string, unknown> } | null;
}>;

interface RegistryConfig {
  defaultRegistry: string;
  scopedRegistries: Map<string, string>;
}

export interface ResolveManyOptions {
  concurrency: number;
  timeoutMs?: number;
}

export interface ResolveManyResult {
  metadata: Map<string, { latestVersion: string | null; versions: string[] }>;
  errors: Map<string, string>;
}

export class NpmRegistryClient {
  private readonly requesterPromise: Promise<RequestLike>;

  constructor(cwd?: string) {
    this.requesterPromise = createRequester(cwd);
  }

  async resolvePackageMetadata(
    packageName: string,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<{ latestVersion: string | null; versions: string[] }> {
    const requester = await this.requesterPromise;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await requester(packageName, timeoutMs);
        if (response.status === 404) {
          return { latestVersion: null, versions: [] };
        }
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Registry temporary error: ${response.status}`);
        }
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Registry request failed: ${response.status}`);
        }

        const versions = Object.keys(response.data?.versions ?? {});
        return { latestVersion: response.data?.["dist-tags"]?.latest ?? null, versions };
      } catch (error) {
        lastError = String(error);
        if (attempt < 3) {
          await sleep(120 * attempt);
        }
      }
    }

    throw new Error(`Unable to resolve ${packageName}: ${lastError ?? "unknown error"}`);
  }

  async resolveLatestVersion(packageName: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string | null> {
    const metadata = await this.resolvePackageMetadata(packageName, timeoutMs);
    return metadata.latestVersion;
  }

  async resolveManyPackageMetadata(
    packageNames: string[],
    options: ResolveManyOptions,
  ): Promise<ResolveManyResult> {
    const unique = Array.from(new Set(packageNames));
    const metadata = new Map<string, { latestVersion: string | null; versions: string[] }>();
    const errors = new Map<string, string>();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const results = await asyncPool(
      options.concurrency,
      unique.map((pkg) => async () => {
        try {
          const packageMetadata = await this.resolvePackageMetadata(pkg, timeoutMs);
          return { pkg, packageMetadata, error: null as string | null };
        } catch (error) {
          return { pkg, packageMetadata: null, error: String(error) };
        }
      }),
    );

    for (const result of results) {
      if (result instanceof Error) {
        continue;
      }
      if (result.error) {
        errors.set(result.pkg, result.error);
      } else if (result.packageMetadata) {
        metadata.set(result.pkg, result.packageMetadata);
      }
    }

    return { metadata, errors };
  }

  async resolveManyLatestVersions(
    packageNames: string[],
    options: ResolveManyOptions,
  ): Promise<{ versions: Map<string, string | null>; errors: Map<string, string> }> {
    const metadataResult = await this.resolveManyPackageMetadata(packageNames, options);
    const versions = new Map<string, string | null>();
    for (const [name, value] of metadataResult.metadata) {
      versions.set(name, value.latestVersion);
    }
    return {
      versions,
      errors: metadataResult.errors,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createRequester(cwd?: string): Promise<RequestLike> {
  const registryConfig = await loadRegistryConfig(cwd ?? process.cwd());
  const undiciRequester = await tryCreateUndiciRequester(registryConfig);
  if (undiciRequester) return undiciRequester;

  return async (packageName: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const registry = resolveRegistryForPackage(packageName, registryConfig);
    const url = buildRegistryUrl(registry, packageName);

    try {
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "user-agent": USER_AGENT,
        },
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as
        | { "dist-tags"?: { latest?: string }; versions?: Record<string, unknown> }
        | null;
      return { status: response.status, data };
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function tryCreateUndiciRequester(registryConfig: RegistryConfig): Promise<RequestLike | null> {
  try {
    const dynamicImport = Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
    const undici = await dynamicImport("undici");

    return async (packageName: string, timeoutMs: number) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const registry = resolveRegistryForPackage(packageName, registryConfig);
      const url = buildRegistryUrl(registry, packageName);

      try {
        const res = await undici.request(url, {
          method: "GET",
          headers: {
            accept: "application/json",
            "user-agent": USER_AGENT,
          },
          signal: controller.signal,
        });

        const bodyText = await res.body.text();
        let data: { "dist-tags"?: { latest?: string }; versions?: Record<string, unknown> } | null = null;
        try {
          data = JSON.parse(bodyText) as { "dist-tags"?: { latest?: string }; versions?: Record<string, unknown> };
        } catch {
          data = null;
        }

        return { status: res.statusCode, data };
      } finally {
        clearTimeout(timeout);
      }
    };
  } catch {
    return null;
  }
}

async function loadRegistryConfig(cwd: string): Promise<RegistryConfig> {
  const homeNpmrc = path.join(os.homedir(), ".npmrc");
  const projectNpmrc = path.join(cwd, ".npmrc");
  const merged = new Map<string, string>();

  for (const filePath of [homeNpmrc, projectNpmrc]) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const parsed = parseNpmrc(content);
      for (const [key, value] of parsed) {
        merged.set(key, value);
      }
    } catch {
      // ignore missing/unreadable file
    }
  }

  const defaultRegistry = normalizeRegistryUrl(merged.get("registry") ?? DEFAULT_REGISTRY);
  const scopedRegistries = new Map<string, string>();
  for (const [key, value] of merged) {
    if (!key.startsWith("@") || !key.endsWith(":registry")) continue;
    const scope = key.slice(0, key.indexOf(":registry"));
    if (scope.length > 1) {
      scopedRegistries.set(scope, normalizeRegistryUrl(value));
    }
  }

  return { defaultRegistry, scopedRegistries };
}

function parseNpmrc(content: string): Map<string, string> {
  const values = new Map<string, string>();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#") || trimmed.startsWith(";")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key.length > 0 && value.length > 0) {
      values.set(key, value);
    }
  }
  return values;
}

function normalizeRegistryUrl(value: string): string {
  const normalized = value.endsWith("/") ? value : `${value}/`;
  return normalized;
}

function resolveRegistryForPackage(packageName: string, config: RegistryConfig): string {
  const scope = extractScope(packageName);
  if (scope) {
    const scoped = config.scopedRegistries.get(scope);
    if (scoped) return scoped;
  }
  return config.defaultRegistry;
}

function extractScope(packageName: string): string | null {
  if (!packageName.startsWith("@")) return null;
  const firstSlash = packageName.indexOf("/");
  if (firstSlash <= 1) return null;
  return packageName.slice(0, firstSlash);
}

function buildRegistryUrl(registry: string, packageName: string): string {
  const base = normalizeRegistryUrl(registry);
  return new URL(encodeURIComponent(packageName), base).toString();
}
