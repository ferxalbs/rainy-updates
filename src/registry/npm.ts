import { asyncPool } from "../utils/async-pool.js";

const DEFAULT_TIMEOUT_MS = 8000;
const USER_AGENT = "@rainy-updates/cli";

type RequestLike = (packageName: string, timeoutMs: number) => Promise<{
  status: number;
  data: { "dist-tags"?: { latest?: string } } | null;
}>;

export interface ResolveManyOptions {
  concurrency: number;
  timeoutMs?: number;
}

export interface ResolveManyResult {
  versions: Map<string, string | null>;
  errors: Map<string, string>;
}

export class NpmRegistryClient {
  private readonly requesterPromise: Promise<RequestLike>;

  constructor() {
    this.requesterPromise = createRequester();
  }

  async resolveLatestVersion(packageName: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string | null> {
    const requester = await this.requesterPromise;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await requester(packageName, timeoutMs);
        if (response.status === 404) return null;
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Registry temporary error: ${response.status}`);
        }
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Registry request failed: ${response.status}`);
        }

        return response.data?.["dist-tags"]?.latest ?? null;
      } catch (error) {
        lastError = String(error);
        if (attempt < 3) {
          await sleep(120 * attempt);
        }
      }
    }

    throw new Error(`Unable to resolve ${packageName}: ${lastError ?? "unknown error"}`);
  }

  async resolveManyLatestVersions(
    packageNames: string[],
    options: ResolveManyOptions,
  ): Promise<ResolveManyResult> {
    const unique = Array.from(new Set(packageNames));
    const versions = new Map<string, string | null>();
    const errors = new Map<string, string>();
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const results = await asyncPool(
      options.concurrency,
      unique.map((pkg) => async () => {
        try {
          const latest = await this.resolveLatestVersion(pkg, timeoutMs);
          return { pkg, latest, error: null as string | null };
        } catch (error) {
          return { pkg, latest: null, error: String(error) };
        }
      }),
    );

    for (const result of results) {
      if (result instanceof Error) {
        continue;
      }
      if (result.error) {
        errors.set(result.pkg, result.error);
      } else {
        versions.set(result.pkg, result.latest);
      }
    }

    return { versions, errors };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createRequester(): Promise<RequestLike> {
  const undiciRequester = await tryCreateUndiciRequester();
  if (undiciRequester) return undiciRequester;

  return async (packageName: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
        headers: {
          accept: "application/json",
          "user-agent": USER_AGENT,
        },
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => null)) as { "dist-tags"?: { latest?: string } } | null;
      return { status: response.status, data };
    } finally {
      clearTimeout(timeout);
    }
  };
}

async function tryCreateUndiciRequester(): Promise<RequestLike | null> {
  try {
    const dynamicImport = Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
    const undici = await dynamicImport("undici");
    const pool = new undici.Pool("https://registry.npmjs.org", {
      connections: 20,
      pipelining: 10,
      allowH2: true,
    });

    return async (packageName: string, timeoutMs: number) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await pool.request({
          path: `/${encodeURIComponent(packageName)}`,
          method: "GET",
          headers: {
            accept: "application/json",
            "user-agent": USER_AGENT,
          },
          signal: controller.signal,
        });

        const bodyText = await res.body.text();
        let data: { "dist-tags"?: { latest?: string } } | null = null;
        try {
          data = JSON.parse(bodyText) as { "dist-tags"?: { latest?: string } };
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
