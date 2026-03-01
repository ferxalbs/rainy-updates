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
  data: PackumentData | null;
  retryAfterMs: number | null;
}>;

type PackumentData = {
  "dist-tags"?: { latest?: string };
  versions?: Record<string, { scripts?: Record<string, string> }>;
  time?: Record<string, string>;
  homepage?: string;
  repository?: { url?: string } | string;
};

interface RegistryConfig {
  defaultRegistry: string;
  scopedRegistries: Map<string, string>;
  authByRegistry: Map<string, RegistryAuth>;
}

interface RegistryAuth {
  token?: string;
  basicAuth?: string;
  alwaysAuth: boolean;
}

export interface ResolveManyOptions {
  concurrency: number;
  timeoutMs?: number;
  retries?: number;
}

export interface RegistryClientOptions {
  timeoutMs?: number;
  retries?: number;
}

export interface ResolveManyResult {
  metadata: Map<string, {
    latestVersion: string | null;
    versions: string[];
    publishedAtByVersion: Record<string, number>;
    homepage?: string;
    repository?: string;
    hasInstallScript: boolean;
  }>;
  errors: Map<string, string>;
}

export class NpmRegistryClient {
  private readonly requesterPromise: Promise<RequestLike>;
  private readonly defaultTimeoutMs: number;
  private readonly defaultRetries: number;

  constructor(cwd?: string, options?: RegistryClientOptions) {
    this.requesterPromise = createRequester(cwd);
    this.defaultTimeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultRetries = Math.max(1, options?.retries ?? 3);
  }

  async resolvePackageMetadata(packageName: string, timeoutMs = this.defaultTimeoutMs, retries = this.defaultRetries): Promise<{
    latestVersion: string | null;
    versions: string[];
    publishedAtByVersion: Record<string, number>;
    homepage?: string;
    repository?: string;
    hasInstallScript: boolean;
  }> {
    const requester = await this.requesterPromise;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const response = await requester(packageName, timeoutMs);
        if (response.status === 404) {
          return { latestVersion: null, versions: [], publishedAtByVersion: {}, hasInstallScript: false };
        }
        if (response.status === 429 || response.status >= 500) {
          throw new RetryableRegistryError(
            `Registry temporary error: ${response.status}`,
            response.retryAfterMs ?? computeBackoffMs(attempt),
          );
        }
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Registry request failed: ${response.status}`);
        }

        const versions = Object.keys(response.data?.versions ?? {});
        return {
          latestVersion: response.data?.["dist-tags"]?.latest ?? null,
          versions,
          publishedAtByVersion: extractPublishTimes(response.data?.time),
          homepage: response.data?.homepage,
          repository: normalizeRepository(response.data?.repository),
          hasInstallScript: detectInstallScript(response.data?.versions),
        };
      } catch (error) {
        lastError = String(error);
        if (attempt < retries) {
          const backoffMs = error instanceof RetryableRegistryError ? error.waitMs : computeBackoffMs(attempt);
          await sleep(backoffMs);
        }
      }
    }

    throw new Error(`Unable to resolve ${packageName}: ${lastError ?? "unknown error"}`);
  }

  async resolveLatestVersion(packageName: string, timeoutMs = this.defaultTimeoutMs): Promise<string | null> {
    const metadata = await this.resolvePackageMetadata(packageName, timeoutMs, this.defaultRetries);
    return metadata.latestVersion;
  }

  async resolveManyPackageMetadata(
    packageNames: string[],
    options: ResolveManyOptions,
  ): Promise<ResolveManyResult> {
    const unique = Array.from(new Set(packageNames));
    const metadata = new Map<string, {
      latestVersion: string | null;
      versions: string[];
      publishedAtByVersion: Record<string, number>;
      homepage?: string;
      repository?: string;
      hasInstallScript: boolean;
    }>();
    const errors = new Map<string, string>();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const retries = options.retries ?? this.defaultRetries;

    const results = await asyncPool(
      options.concurrency,
      unique.map((pkg) => async () => {
        try {
          const packageMetadata = await this.resolvePackageMetadata(pkg, timeoutMs, retries);
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

function normalizeRepository(value: { url?: string } | string | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.url;
}

function detectInstallScript(
  versions: Record<string, { scripts?: Record<string, string> }> | undefined,
): boolean {
  if (!versions) return false;
  for (const metadata of Object.values(versions)) {
    const scripts = metadata?.scripts;
    if (!scripts) continue;
    if (scripts.preinstall || scripts.install || scripts.postinstall) {
      return true;
    }
  }
  return false;
}

function computeBackoffMs(attempt: number): number {
  const baseMs = Math.max(120, attempt * 180);
  const jitterMs = Math.floor(Math.random() * 120);
  return baseMs + jitterMs;
}

class RetryableRegistryError extends Error {
  readonly waitMs: number;

  constructor(message: string, waitMs: number) {
    super(message);
    this.waitMs = waitMs;
  }
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
    const authHeader = resolveAuthHeader(registry, registryConfig);
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": USER_AGENT,
    };
    if (authHeader) {
      headers.authorization = authHeader;
    }

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as PackumentData | null;
      return {
        status: response.status,
        data,
        retryAfterMs: parseRetryAfterHeader(response.headers.get("retry-after")),
      };
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
      const authHeader = resolveAuthHeader(registry, registryConfig);
      const headers: Record<string, string> = {
        accept: "application/json",
        "user-agent": USER_AGENT,
      };
      if (authHeader) {
        headers.authorization = authHeader;
      }

      try {
        const res = await undici.request(url, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        const bodyText = await res.body.text();
        let data: PackumentData | null = null;
        try {
          data = JSON.parse(bodyText) as PackumentData;
        } catch {
          data = null;
        }

        const retryAfter = (() => {
          const header = res.headers["retry-after"];
          if (Array.isArray(header)) return header[0] ?? null;
          if (typeof header === "string") return header;
          return null;
        })();

        return {
          status: res.statusCode,
          data,
          retryAfterMs: parseRetryAfterHeader(retryAfter),
        };
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
  const authByRegistry = new Map<string, RegistryAuth>();
  for (const [key, value] of merged) {
    if (!key.startsWith("@") || !key.endsWith(":registry")) continue;
    const scope = key.slice(0, key.indexOf(":registry"));
    if (scope.length > 1) {
      scopedRegistries.set(scope, normalizeRegistryUrl(value));
    }
  }

  for (const [key, value] of merged) {
    if (!key.startsWith("//")) continue;
    const [registryKey, authKey] = key.split(/:(.+)/).filter(Boolean);
    if (!registryKey || !authKey) continue;
    const registry = normalizeRegistryUrl(`https:${registryKey}`);
    const current = authByRegistry.get(registry) ?? { alwaysAuth: false };
    const resolvedValue = substituteEnvValue(value);
    if (authKey === "_authToken") {
      current.token = resolvedValue;
    } else if (authKey === "_auth") {
      current.basicAuth = resolvedValue;
    } else if (authKey === "always-auth") {
      current.alwaysAuth = resolvedValue === "true";
    }
    authByRegistry.set(registry, current);
  }

  if (merged.get("always-auth") === "true") {
    const current = authByRegistry.get(defaultRegistry) ?? { alwaysAuth: false };
    current.alwaysAuth = true;
    authByRegistry.set(defaultRegistry, current);
  }

  return { defaultRegistry, scopedRegistries, authByRegistry };
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

function substituteEnvValue(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, name: string) => process.env[name] ?? "");
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

function resolveAuthHeader(registry: string, config: RegistryConfig): string | undefined {
  const registryUrl = normalizeRegistryUrl(registry);
  const auth = findRegistryAuth(registryUrl, config.authByRegistry);
  if (!auth) return undefined;
  if (!auth.alwaysAuth && !registryUrl.startsWith("https://")) return undefined;
  if (auth.token) return `Bearer ${auth.token}`;
  if (auth.basicAuth) return `Basic ${auth.basicAuth}`;
  return undefined;
}

function findRegistryAuth(registry: string, authByRegistry: Map<string, RegistryAuth>): RegistryAuth | undefined {
  let matched: RegistryAuth | undefined;
  let longest = -1;
  for (const [candidate, auth] of authByRegistry) {
    if (!registry.startsWith(candidate)) continue;
    if (candidate.length > longest) {
      matched = auth;
      longest = candidate.length;
    }
  }
  return matched;
}

function parseRetryAfterHeader(value: string | null): number | null {
  if (!value) return null;
  const parsedSeconds = Number(value);
  if (Number.isFinite(parsedSeconds) && parsedSeconds >= 0) {
    return Math.round(parsedSeconds * 1000);
  }

  const untilMs = Date.parse(value);
  if (!Number.isFinite(untilMs)) return null;
  const delta = untilMs - Date.now();
  if (delta <= 0) return 0;
  return delta;
}

function extractPublishTimes(timeMap: Record<string, string> | undefined): Record<string, number> {
  if (!timeMap) return {};
  const publishedAtByVersion: Record<string, number> = {};
  for (const [version, rawDate] of Object.entries(timeMap)) {
    if (version === "created" || version === "modified") continue;
    const timestamp = Date.parse(rawDate);
    if (Number.isFinite(timestamp)) {
      publishedAtByVersion[version] = timestamp;
    }
  }
  return publishedAtByVersion;
}
