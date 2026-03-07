import { check } from "../core/check.js";
import type { CheckOptions, CheckResult, ServiceContext } from "../types/index.js";

export async function runCheckService(
  options: CheckOptions,
  _context?: ServiceContext,
): Promise<CheckResult> {
  return check({
    ...options,
    stream: false,
  });
}
