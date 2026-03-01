import path from "node:path";
import type {
  CiProfile,
  DependencyKind,
  FailOnLevel,
  GroupBy,
  LockfileMode,
  LogLevel,
  OutputFormat,
  TargetLevel,
} from "../types/index.js";

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
  registryTimeoutMs?: number;
  registryRetries?: number;
  offline?: boolean;
  stream?: boolean;
  policyFile?: string;
  prReportFile?: string;
  failOn?: FailOnLevel;
  maxUpdates?: number;
  fixPr?: boolean;
  fixBranch?: string;
  fixCommitMessage?: string;
  fixDryRun?: boolean;
  fixPrNoCheckout?: boolean;
  fixPrBatchSize?: number;
  noPrReport?: boolean;
  logLevel?: LogLevel;
  groupBy?: GroupBy;
  groupMax?: number;
  cooldownDays?: number;
  prLimit?: number;
  onlyChanged?: boolean;
  ciProfile?: CiProfile;
  lockfileMode?: LockfileMode;
  interactive?: boolean;
  showImpact?: boolean;
  showHomepage?: boolean;
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
      return (await Bun.file(filePath).json()) as FileConfig;
    } catch {
      // noop
    }
  }

  return {};
}

async function loadPackageConfig(cwd: string): Promise<FileConfig> {
  const packagePath = path.join(cwd, "package.json");

  try {
    const parsed = (await Bun.file(packagePath).json()) as {
      rainyUpdates?: FileConfig;
    };
    return parsed.rainyUpdates ?? {};
  } catch {
    return {};
  }
}
