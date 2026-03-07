import { buildReviewResult, createDoctorResult } from "../core/review-model.js";
import type { DoctorOptions, DoctorResult, ServiceContext } from "../types/index.js";

export async function runDoctorService(
  options: DoctorOptions,
  _context?: ServiceContext,
): Promise<DoctorResult> {
  const review = await buildReviewResult(options);
  return createDoctorResult(review);
}
