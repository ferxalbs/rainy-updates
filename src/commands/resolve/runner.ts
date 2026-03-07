import type { ResolveOptions, ResolveResult } from "../../types/index.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { writeStderr, writeStdout } from "../../utils/runtime.js";
import { renderResolveTable, runResolveService } from "../../services/resolve.js";

/**
 * Entry point for `rup resolve`. Lazy-loaded by cli.ts.
 *
 * Modes:
 *   default          — check current peer-dep state for conflicts
 *   --after-update   — re-check after applying pending `rup check` updates
 *                      in-memory (reads proposed versions from check runner)
 *
 * The pure-TS peer graph is assembled entirely from registry data; no subprocess
 * is spawned. When the cache is warm this completes in < 1 s for typical projects.
 */
export async function runResolve(
  options: ResolveOptions,
): Promise<ResolveResult> {
  const result = await runResolveService(options);

  if (!options.silent) {
    writeStdout(renderResolveTable(result, options) + "\n");
  }

  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
    if (!options.silent) {
      writeStderr(
        `[resolve] JSON report written to ${options.jsonFile}\n`,
      );
    }
  }

  return result;
}
