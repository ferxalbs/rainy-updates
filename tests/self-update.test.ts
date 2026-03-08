import { expect, test } from "bun:test";
import { runSelfUpdateService, formatSelfUpdateNotice } from "../src/services/self-update.js";

test("self-update check reports outdated status and recommended command", async () => {
  const result = await runSelfUpdateService(
    {
      cwd: process.cwd(),
      action: "check",
      yes: false,
      packageManager: "npm",
    },
    {
      useCache: false,
      resolveLatestVersion: async () => "9.9.9",
      detectChannel: () => "global-npm",
      now: () => 0,
    },
  );

  expect(result.outdated).toBe(true);
  expect(result.latestVersion).toBe("9.9.9");
  expect(result.recommendedCommand).toBe("npm install -g @rainy-updates/cli@latest");
  expect(formatSelfUpdateNotice(result)).toContain("Update available");
});

test("self-update apply requires --yes confirmation", async () => {
  const result = await runSelfUpdateService(
    {
      cwd: process.cwd(),
      action: "apply",
      yes: false,
      packageManager: "pnpm",
    },
    {
      useCache: false,
      resolveLatestVersion: async () => "9.9.9",
      detectChannel: () => "global-pnpm",
    },
  );

  expect(result.applied).toBe(false);
  expect(result.warnings.some((warning) => warning.includes("--apply --yes"))).toBe(true);
});

test("self-update apply does not mutate standalone binary installs", async () => {
  const result = await runSelfUpdateService(
    {
      cwd: process.cwd(),
      action: "apply",
      yes: true,
      packageManager: "auto",
    },
    {
      useCache: false,
      resolveLatestVersion: async () => "9.9.9",
      detectChannel: () => "binary",
      detectManager: () => "npm",
    },
  );

  expect(result.applied).toBe(false);
  expect(result.warnings.some((warning) => warning.includes("Standalone binary"))).toBe(true);
});

test("self-update check refreshes stale cached latest versions", async () => {
  let cachedLatestVersion: string | null = "0.6.10";
  const result = await runSelfUpdateService(
    {
      cwd: process.cwd(),
      action: "check",
      yes: false,
      packageManager: "bun",
    },
    {
      useCache: true,
      getCachedLatestVersion: async () => cachedLatestVersion,
      setCachedLatestVersion: async (latestVersion) => {
        cachedLatestVersion = latestVersion;
      },
      resolveLatestVersion: async () => "9.9.9",
      detectChannel: () => "global-bun",
    },
  );

  expect(result.latestVersion).toBe("9.9.9");
  expect(result.outdated).toBe(true);
  expect(
    result.warnings.some((warning) => warning.includes("Cached latest version")),
  ).toBe(true);
  expect(cachedLatestVersion).toBe("9.9.9");
});

test("self-update check warns and falls back when stale cache refresh fails", async () => {
  const result = await runSelfUpdateService(
    {
      cwd: process.cwd(),
      action: "check",
      yes: false,
      packageManager: "auto",
    },
    {
      useCache: true,
      getCachedLatestVersion: async () => "0.6.10",
      resolveLatestVersion: async () => {
        throw new Error("registry unavailable");
      },
    },
  );

  expect(result.latestVersion).toBe("0.6.10");
  expect(result.outdated).toBe(false);
  expect(
    result.warnings.some((warning) => warning.includes("Registry refresh failed")),
  ).toBe(true);
});
