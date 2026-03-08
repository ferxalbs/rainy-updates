import { z } from "zod";

const logLevelSchema = z.enum(["error", "warn", "info", "debug"]);
const targetSchema = z.enum(["patch", "minor", "major", "latest"]);
const formatSchema = z.enum(["table", "json", "minimal", "github", "metrics"]);
const includeKindsSchema = z.array(
  z.enum([
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]),
);
const ciProfileSchema = z.enum(["minimal", "strict", "enterprise"]);
const lockfileModeSchema = z.enum(["preserve", "update", "error"]);
const packageManagerSchema = z.enum(["auto", "bun", "npm", "pnpm", "yarn"]);
const webhookEventSchema = z.enum([
  "audit.critical",
  "upgrade.applied",
  "health.degraded",
  "check.complete",
  "doctor.score",
]);

export const WebhookConfigSchema = z.object({
  event: webhookEventSchema,
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  secret: z.string().min(1).optional(),
});

export const WatchConfigSchema = z.object({
  intervalMs: z.number().int().positive().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  notify: z.enum(["slack", "discord", "http"]).optional(),
  webhook: z.string().url().optional(),
  daemon: z.boolean().optional(),
});

export const McpConfigSchema = z.object({
  transport: z.enum(["stdio", "http"]).optional(),
  toolTimeoutMs: z.number().int().positive().optional(),
  port: z.number().int().positive().max(65535).optional(),
  host: z.string().min(1).optional(),
  authToken: z.string().min(1).optional(),
  httpPath: z.string().min(1).optional(),
});

export const SelfUpdateConfigSchema = z.object({
  check: z.enum(["auto", "off"]).optional(),
  ttlHours: z.number().int().positive().optional(),
});

export const FileConfigSchema = z.object({
  target: targetSchema.optional(),
  filter: z.string().optional(),
  reject: z.string().optional(),
  cacheTtlSeconds: z.number().nonnegative().optional(),
  includeKinds: includeKindsSchema.optional(),
  ci: z.boolean().optional(),
  format: formatSchema.optional(),
  workspace: z.boolean().optional(),
  jsonFile: z.string().optional(),
  githubOutputFile: z.string().optional(),
  sarifFile: z.string().optional(),
  concurrency: z.number().int().positive().optional(),
  registryTimeoutMs: z.number().int().positive().optional(),
  registryRetries: z.number().int().nonnegative().optional(),
  offline: z.boolean().optional(),
  stream: z.boolean().optional(),
  policyFile: z.string().optional(),
  prReportFile: z.string().optional(),
  failOn: z.enum(["none", "patch", "minor", "major", "any"]).optional(),
  maxUpdates: z.number().int().positive().optional(),
  fixPr: z.boolean().optional(),
  fixBranch: z.string().optional(),
  fixCommitMessage: z.string().optional(),
  fixDryRun: z.boolean().optional(),
  fixPrNoCheckout: z.boolean().optional(),
  fixPrBatchSize: z.number().int().positive().optional(),
  noPrReport: z.boolean().optional(),
  logLevel: logLevelSchema.optional(),
  groupBy: z.enum(["none", "name", "scope", "kind", "risk"]).optional(),
  groupMax: z.number().int().positive().optional(),
  cooldownDays: z.number().int().nonnegative().optional(),
  prLimit: z.number().int().positive().optional(),
  onlyChanged: z.boolean().optional(),
  ciProfile: ciProfileSchema.optional(),
  lockfileMode: lockfileModeSchema.optional(),
  interactive: z.boolean().optional(),
  showImpact: z.boolean().optional(),
  showHomepage: z.boolean().optional(),
  install: z.boolean().optional(),
  packageManager: packageManagerSchema.optional(),
  sync: z.boolean().optional(),
  mcp: McpConfigSchema.optional(),
  selfUpdate: SelfUpdateConfigSchema.optional(),
  watch: WatchConfigSchema.optional(),
  webhooks: z.array(WebhookConfigSchema).optional(),
});

export type ValidatedFileConfig = z.infer<typeof FileConfigSchema>;
