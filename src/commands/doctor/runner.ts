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
  if (options.badgeFile) {
    await writeFileAtomic(
      options.badgeFile,
      stableStringify(createDoctorBadge(doctor.score), 2) + "\n",
    );
  }
  return doctor;
}

function createDoctorBadge(score: number): {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
} {
  if (score >= 90) {
    return { schemaVersion: 1, label: "repo health", message: `${score}/100 healthy`, color: "2ea043" };
  }
  if (score >= 75) {
    return { schemaVersion: 1, label: "repo health", message: `${score}/100 warning`, color: "d29922" };
  }
  if (score >= 50) {
    return { schemaVersion: 1, label: "repo health", message: `${score}/100 at risk`, color: "f85149" };
  }
  return { schemaVersion: 1, label: "repo health", message: `${score}/100 critical`, color: "a40e26" };
}
