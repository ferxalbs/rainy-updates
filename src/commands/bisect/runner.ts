import type { BisectOptions, BisectResult } from "../../types/index.js";
import { writeStdout } from "../../utils/runtime.js";
import { renderBisectResult, runBisectService } from "../../services/bisect.js";

/**
 * Entry point for the `bisect` command. Lazy-loaded by cli.ts.
 * Fully isolated: does NOT import anything from core/options.ts.
 */
export async function runBisect(options: BisectOptions): Promise<BisectResult> {
  const result = await runBisectService(options);
  writeStdout(renderBisectResult(result));

  return result;
}
