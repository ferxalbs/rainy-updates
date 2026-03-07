import {
  renderDoctorAgentReport,
  renderDoctorResult,
} from "../../core/review-model.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { writeStdout } from "../../utils/runtime.js";
import type { DoctorOptions, DoctorResult } from "../../types/index.js";
import { runDoctorService } from "../../services/doctor.js";

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
  const doctor = await runDoctorService(options);
  const output = options.agentReport
    ? renderDoctorAgentReport(doctor)
    : renderDoctorResult(doctor, options.verdictOnly);
  writeStdout(output + "\n");
  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(doctor, 2) + "\n");
  }
  return doctor;
}
