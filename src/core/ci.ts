import type { CheckOptions, CheckResult, UpgradeOptions } from "../types/index.js";
import { check } from "./check.js";
import { warmCache } from "./warm-cache.js";
import { upgrade } from "./upgrade.js";

export async function runCi(options: CheckOptions): Promise<CheckResult> {
  const profile = options.ciProfile;

  if (profile !== "minimal") {
    await warmCache({
      ...options,
      offline: false,
      ci: true,
      format: "minimal",
    });
  }

  const checkOptions: CheckOptions = {
    ...options,
    ci: true,
    offline: profile === "minimal" ? options.offline : true,
    concurrency: profile === "enterprise" ? Math.max(options.concurrency, 32) : options.concurrency,
  };

  if (options.fixPr) {
    const upgradeOptions: UpgradeOptions = {
      ...checkOptions,
      install: false,
      packageManager: "auto",
      sync: false,
    };
    return await upgrade(upgradeOptions);
  }

  return await check(checkOptions);
}
