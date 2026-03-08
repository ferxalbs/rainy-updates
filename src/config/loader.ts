import path from "node:path";
import type {
  CiProfile,
  SelectedPackageManager,
  DependencyKind,
  FailOnLevel,
  GroupBy,
  LockfileMode,
  LogLevel,
  OutputFormat,
  TargetLevel,
  WebhookConfig,
  SelfUpdateCheckMode,
} from "../types/index.js";
import { FileConfigSchema } from "./schema.js";

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
  packageManager?: SelectedPackageManager;
  sync?: boolean;
  mcp?: {
    transport?: "stdio" | "http";
    toolTimeoutMs?: number;
    initializeTimeoutMs?: number;
    maxInflight?: number;
    maxQueue?: number;
    httpMode?: "stateless" | "stateful";
    diagJson?: boolean;
    port?: number;
    host?: string;
    authToken?: string;
    httpPath?: string;
  };
  selfUpdate?: {
    check?: SelfUpdateCheckMode;
    ttlHours?: number;
  };
  watch?: {
    intervalMs?: number;
    severity?: "critical" | "high" | "medium" | "low";
    notify?: "slack" | "discord" | "http";
    webhook?: string;
    daemon?: boolean;
  };
  webhooks?: WebhookConfig[];
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
    const file = Bun.file(filePath);
    if (!(await file.exists())) continue;
    return validateFileConfig(await file.json(), filePath);
  }

  return {};
}

async function loadPackageConfig(cwd: string): Promise<FileConfig> {
  const packagePath = path.join(cwd, "package.json");
  const file = Bun.file(packagePath);
  if (!(await file.exists())) {
    return {};
  }

  try {
    const parsed = (await file.json()) as {
      rainyUpdates?: unknown;
    };
    return validateFileConfig(parsed.rainyUpdates ?? {}, `${packagePath}#rainyUpdates`);
  } catch {
    return {};
  }
}

function validateFileConfig(input: unknown, source: string): FileConfig {
  const parsed = FileConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Invalid config in ${source}: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"} ${issue.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}
