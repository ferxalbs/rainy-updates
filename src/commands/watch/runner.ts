import { stableStringify } from "../../utils/stable-json.js";
import { writeStdout } from "../../utils/runtime.js";
import type { WatchOptions, WatchResult } from "../../types/index.js";
import { runWatchService } from "../../services/watch.js";

export async function runWatch(options: WatchOptions): Promise<WatchResult> {
  const result = await runWatchService(options);
  writeStdout(stableStringify(result, 2) + "\n");
  return result;
}
