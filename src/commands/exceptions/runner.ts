import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { writeStdout } from "../../utils/runtime.js";
import type { ExceptionsOptions, ExceptionsResult } from "../../types/index.js";
import { runExceptionsService } from "../../services/exceptions.js";

export async function runExceptions(
  options: ExceptionsOptions,
): Promise<ExceptionsResult> {
  const result = await runExceptionsService(options);

  const rendered =
    options.format === "json"
      ? stableStringify(result, 2)
      : renderExceptionsResult(result);

  writeStdout(rendered + "\n");
  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
  }
  return result;
}

function renderExceptionsResult(result: ExceptionsResult): string {
  const lines = [
    `Exceptions file: ${result.filePath}`,
    `Action: ${result.action}`,
    `Entries: ${result.entries.length} (active=${result.active}, expired=${result.expired})`,
  ];

  if (result.entries.length > 0) {
    lines.push("", "Entries:");
    for (const entry of result.entries) {
      lines.push(
        `- ${entry.id} :: ${entry.packageName}${entry.cveId ? ` (${entry.cveId})` : ""} status=${entry.status} expires=${entry.expiresAt}`,
      );
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    lines.push(...result.warnings.map((warning) => `- ${warning}`));
  }
  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    lines.push(...result.errors.map((error) => `- ${error}`));
  }

  return lines.join("\n");
}
