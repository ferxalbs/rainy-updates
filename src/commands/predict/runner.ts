import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { writeStdout } from "../../utils/runtime.js";
import type { PredictOptions, PredictResult } from "../../types/index.js";
import { renderPredictResult, runPredictService } from "../../services/predict.js";

export async function runPredict(options: PredictOptions): Promise<PredictResult> {
  const result = await runPredictService(options);
  const rendered =
    options.format === "json"
      ? stableStringify(result, 2)
      : renderPredictResult(result, options.format);

  writeStdout(rendered + "\n");
  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
  }
  return result;
}
