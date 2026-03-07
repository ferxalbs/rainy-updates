import { writeFileAtomic } from "../../utils/io.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeStderr, writeStdout } from "../../utils/runtime.js";
import type { AuditOptions, AuditResult } from "../../types/index.js";
import {
  renderAuditSourceHealth,
  renderAuditSummary,
  renderAuditTable,
} from "./mapper.js";
import { runAuditService } from "../../services/audit.js";

export async function runAudit(options: AuditOptions): Promise<AuditResult> {
  const result = await runAuditService(options);

  if (!options.silent) {
    if (options.reportFormat === "summary") {
      writeStdout(
        renderAuditSummary(result.packages) +
          renderAuditSourceHealth(result.sourceHealth) +
          "\n",
      );
    } else if (options.reportFormat === "table" || !options.jsonFile) {
      writeStdout(
        renderAuditTable(result.advisories) +
          renderAuditSourceHealth(result.sourceHealth) +
          "\n",
      );
    }
  }

  if (options.jsonFile) {
    await writeFileAtomic(
      options.jsonFile,
      stableStringify(
        {
          advisories: result.advisories,
          packages: result.packages,
          sourcesUsed: result.sourcesUsed,
          sourceHealth: result.sourceHealth,
          resolution: result.resolution,
          errors: result.errors,
          warnings: result.warnings,
        },
        2,
      ) + "\n",
    );
    if (!options.silent) {
      writeStderr(`[audit] JSON report written to ${options.jsonFile}\n`);
    }
  }

  return result;
}
