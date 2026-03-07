import { upgrade } from "../core/upgrade.js";
import type {
  ServiceContext,
  UpgradeOptions,
  UpgradeResult,
} from "../types/index.js";

export async function runUpgradeService(
  options: UpgradeOptions,
  _context?: ServiceContext,
): Promise<UpgradeResult> {
  return upgrade(options);
}
