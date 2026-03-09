import { runBadgeService, renderBadgeResult } from "../../services/badge.js";
import { writeStdout } from "../../utils/runtime.js";
import type { BadgeOptions, BadgeResult } from "../../types/index.js";

export async function runBadge(options: BadgeOptions): Promise<BadgeResult> {
  const result = await runBadgeService(options);
  result.format = options.format;
  writeStdout(renderBadgeResult(result) + "\n");
  return result;
}
