import {
  diffBaseline,
  saveBaseline,
  type BaselineDiffResult,
  type BaselineSaveResult,
} from "../core/baseline.js";
import type { BaselineOptions, ServiceContext } from "../types/index.js";

export async function saveBaselineService(
  options: BaselineOptions,
  _context?: ServiceContext,
): Promise<BaselineSaveResult> {
  return saveBaseline(options);
}

export async function diffBaselineService(
  options: BaselineOptions,
  _context?: ServiceContext,
): Promise<BaselineDiffResult> {
  return diffBaseline(options);
}
