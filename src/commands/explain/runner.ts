import { writeFileAtomic } from "../../utils/io.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeStdout } from "../../utils/runtime.js";
import type { ExplainOptions, ExplainResult } from "../../types/index.js";
import { renderExplainResult, runExplainService } from "../../services/explain.js";

export async function runExplain(options: ExplainOptions): Promise<ExplainResult> {
  const result = await runExplainService(options);
  const rendered =
    options.format === "json"
      ? stableStringify(result, 2)
      : renderExplainResult(result, options.format);

  writeStdout(rendered + "\n");
  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
  }
  return result;
}
