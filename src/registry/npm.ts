const DEFAULT_TIMEOUT_MS = 8000;

export async function resolveLatestVersion(packageName: string): Promise<string | null> {
  const encoded = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encoded}`;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          "accept": "application/json",
          "user-agent": "@rainy-updates/cli",
        },
        signal: controller.signal,
      });

      if (response.status === 404) {
        clearTimeout(timeout);
        return null;
      }

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Registry temporary error: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`Registry request failed: ${response.status}`);
      }

      const body = (await response.json()) as {
        "dist-tags"?: { latest?: string };
      };

      clearTimeout(timeout);
      return body["dist-tags"]?.latest ?? null;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt === 3) break;
      await sleep(150 * attempt);
    }
  }

  throw new Error(`Unable to resolve ${packageName}: ${String(lastError)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
