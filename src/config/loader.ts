import { promises as fs } from "node:fs";
import path from "node:path";
import type { DependencyKind, FailOnLevel, OutputFormat, TargetLevel } from "../types/index.js";

export interface FileConfig {
  target?: TargetLevel;
  filter?: string;
  reject?: string;
  cacheTtlSeconds?: number;
  includeKinds?: DependencyKind[];
  ci?: boolean;
  format?: OutputFormat;
  workspace?: boolean;
  jsonFile?: string;
  githubOutputFile?: string;
  sarifFile?: string;
  concurrency?: number;
  offline?: boolean;
  policyFile?: string;
  prReportFile?: string;
  failOn?: FailOnLevel;
  maxUpdates?: number;
  fixPr?: boolean;
  fixBranch?: string;
  fixCommitMessage?: string;
  fixDryRun?: boolean;
  noPrReport?: boolean;
  install?: boolean;
  packageManager?: "auto" | "npm" | "pnpm";
  sync?: boolean;
}

export async function loadConfig(cwd: string): Promise<FileConfig> {
  const fromRc = await loadRcFile(cwd);
  const fromPackage = await loadPackageConfig(cwd);
  return {
    ...fromPackage,
    ...fromRc,
  };
}

async function loadRcFile(cwd: string): Promise<FileConfig> {
  const candidates = [".rainyupdatesrc", ".rainyupdatesrc.json"];

  for (const candidate of candidates) {
    const filePath = path.join(cwd, candidate);
    try {
      const content = await fs.readFile(filePath, "utf8");
      return JSON.parse(content) as FileConfig;
    } catch {
      // noop
    }
  }

  return {};
}

async function loadPackageConfig(cwd: string): Promise<FileConfig> {
  const packagePath = path.join(cwd, "package.json");

  try {
    const content = await fs.readFile(packagePath, "utf8");
    const parsed = JSON.parse(content) as { rainyUpdates?: FileConfig };
    return parsed.rainyUpdates ?? {};
  } catch {
    return {};
  }
}
