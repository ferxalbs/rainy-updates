import { writeFileAtomic } from "../../utils/io.js";
import { stableStringify } from "../../utils/stable-json.js";
import type {
  HealthOptions,
  HealthResult,
} from "../../types/index.js";
import { renderHealthTable, runHealthService } from "../../services/health.js";

/**
 * Lazy-loaded entry point for `rup health`.
 * Discovers packages, queries npm registry for publication metadata,
 * detects stale and deprecated packages, and renders a health report.
 */
export async function runHealth(options: HealthOptions): Promise<HealthResult> {
  const result = await runHealthService(options);

  process.stdout.write(renderHealthTable(result.metrics) + "\n");

  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
    process.stderr.write(
      `[health] JSON report written to ${options.jsonFile}\n`,
    );
  }

  return result;
}
