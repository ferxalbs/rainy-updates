import process from "node:process";
import {
  buildReviewResult,
  createDoctorResult,
  renderDoctorAgentReport,
  renderDoctorResult,
} from "../../core/review-model.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import type { DoctorOptions, DoctorResult } from "../../types/index.js";

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const review = await buildReviewResult(options);
  const doctor = createDoctorResult(review);
  const output = options.agentReport
    ? renderDoctorAgentReport(doctor)
    : renderDoctorResult(doctor, options.verdictOnly);
  process.stdout.write(output + "\n");
  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(doctor, 2) + "\n");
  }
  return doctor;
}
