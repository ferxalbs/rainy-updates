import crypto from "node:crypto";
import path from "node:path";
import type { ArtifactManifest, CheckResult, RunOptions } from "../types/index.js";
import { stableStringify } from "../utils/stable-json.js";
import { writeFileAtomic } from "../utils/io.js";

export function createRunId(command: string, options: RunOptions, result: CheckResult): string {
  const hash = crypto.createHash("sha256");
  hash.update(
    stableStringify(
      {
        command,
        cwd: path.resolve(options.cwd),
        target: options.target,
        workspace: options.workspace,
        ciProfile: options.ciProfile,
        updates: result.updates.map((update) => ({
          packagePath: update.packagePath,
          name: update.name,
          fromRange: update.fromRange,
          toRange: update.toRange,
        })),
      },
      0,
    ),
  );
  return hash.digest("hex").slice(0, 16);
}

export async function writeArtifactManifest(
  command: string,
  options: RunOptions,
  result: CheckResult,
): Promise<ArtifactManifest | null> {
  const shouldWrite =
    options.ci ||
    Boolean(options.jsonFile) ||
    Boolean(options.githubOutputFile) ||
    Boolean(options.sarifFile) ||
    Boolean(options.prReportFile) ||
    Boolean(options.verificationReportFile);
  if (!shouldWrite) return null;

  const runId = result.summary.runId ?? createRunId(command, options, result);
  const artifactManifestPath = path.resolve(
    options.cwd,
    ".artifacts",
    `rainy-manifest-${runId}.json`,
  );
  const manifest: ArtifactManifest = {
    runId,
    createdAt: new Date().toISOString(),
    command,
    projectPath: result.projectPath,
    ciProfile: options.ciProfile,
    artifactManifestPath,
    outputs: {
      jsonFile: options.jsonFile,
      githubOutputFile: options.githubOutputFile,
      sarifFile: options.sarifFile,
      prReportFile: options.prReportFile,
      verificationReportFile: options.verificationReportFile,
    },
  };

  await writeFileAtomic(artifactManifestPath, stableStringify(manifest, 2) + "\n");
  return manifest;
}
