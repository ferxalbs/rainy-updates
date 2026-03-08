import { z } from "zod";
import { CLI_VERSION } from "../generated/version.js";
import { stableStringify } from "../utils/stable-json.js";
import type {
  AuditOptions,
  BaselineOptions,
  BisectOptions,
  CheckOptions,
  DoctorOptions,
  ExplainOptions,
  PredictOptions,
  HealthOptions,
  McpOptions,
  McpToolCallResult,
  McpToolName,
  ResolveOptions,
  ReviewOptions,
  ServiceContext,
  UpgradeOptions,
} from "../types/index.js";
import { createServiceContext } from "../services/context.js";
import { runCheckService } from "../services/check.js";
import { runDoctorService } from "../services/doctor.js";
import { runReviewService } from "../services/review.js";
import { runAuditService } from "../services/audit.js";
import { runUpgradeService } from "../services/upgrade.js";
import { runHealthService } from "../services/health.js";
import { runBisectService } from "../services/bisect.js";
import { runResolveService } from "../services/resolve.js";
import { diffBaselineService, saveBaselineService } from "../services/baseline.js";
import { runExplainService } from "../services/explain.js";
import { runPredictService } from "../services/predict.js";
import { McpToolError } from "./errors.js";

const gitScopeSchema = {
  affected: z.boolean().optional(),
  staged: z.boolean().optional(),
  baseRef: z.string().optional(),
  headRef: z.string().optional(),
  sinceRef: z.string().optional(),
};

const baseInputSchema = z.object({
  cwd: z.string().optional(),
  workspace: z.boolean().optional(),
});

type ToolDefinition = {
  name: McpToolName;
  description: string;
  inputSchema: z.ZodTypeAny;
  jsonSchema: Record<string, unknown>;
  call: (args: Record<string, unknown>, context: ServiceContext) => Promise<McpToolCallResult<unknown>>;
};

export function createMcpTools(serverOptions: McpOptions): ToolDefinition[] {
  const definitions: ToolDefinition[] = [
    {
      name: "rup_check",
      description: "Detect candidate dependency updates with risk metadata.",
      inputSchema: baseInputSchema.extend({
        target: z.enum(["patch", "minor", "major", "latest"]).optional(),
        filter: z.string().optional(),
        reject: z.string().optional(),
        includeKinds: z.array(
          z.enum(["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]),
        ).optional(),
        ...gitScopeSchema,
      }),
      jsonSchema: {
        type: "object",
        properties: {
          cwd: { type: "string" },
          workspace: { type: "boolean" },
          target: { enum: ["patch", "minor", "major", "latest"] },
          filter: { type: "string" },
          reject: { type: "string" },
        },
      },
      call: async (args, context) => {
        const options: CheckOptions = {
          ...defaultCheckOptions(serverOptions, args.cwd, args.workspace),
          target: (args.target as CheckOptions["target"]) ?? "latest",
          filter: (args.filter as string | undefined) ?? undefined,
          reject: (args.reject as string | undefined) ?? undefined,
          includeKinds: (args.includeKinds as CheckOptions["includeKinds"] | undefined) ?? defaultCheckOptions(serverOptions).includeKinds,
          affected: args.affected as boolean | undefined,
          staged: args.staged as boolean | undefined,
          baseRef: args.baseRef as string | undefined,
          headRef: args.headRef as string | undefined,
          sinceRef: args.sinceRef as string | undefined,
        };
        const result = await runCheckService(options, context);
        return wrapResult(result);
      },
    },
    {
      name: "rup_doctor",
      description: "Summarize dependency health findings and next action.",
      inputSchema: baseInputSchema.extend({
        onlyChanged: z.boolean().optional(),
        includeChangelog: z.boolean().optional(),
        ...gitScopeSchema,
      }),
      jsonSchema: { type: "object", properties: { cwd: { type: "string" } } },
      call: async (args, context) => {
        const options: DoctorOptions = {
          ...defaultCheckOptions(serverOptions, args.cwd, args.workspace),
          verdictOnly: false,
          includeChangelog: (args.includeChangelog as boolean | undefined) ?? false,
          agentReport: false,
          onlyChanged: (args.onlyChanged as boolean | undefined) ?? false,
          affected: args.affected as boolean | undefined,
          staged: args.staged as boolean | undefined,
          baseRef: args.baseRef as string | undefined,
          headRef: args.headRef as string | undefined,
          sinceRef: args.sinceRef as string | undefined,
        };
        const result = await runDoctorService(options, context);
        return wrapResult({
          verdict: result.verdict,
          score: result.score,
          findings: result.findings,
          nextAction: result.recommendedCommand,
          nextActionReason: result.nextActionReason,
        });
      },
    },
    {
      name: "rup_predict",
      description: "Predict upgrade break risk for package, workspace, or decision plan scope.",
      inputSchema: baseInputSchema.extend({
        packageName: z.string().optional(),
        fromPlanFile: z.string().optional(),
        includeChangelog: z.boolean().optional(),
      }).superRefine((value, ctx) => {
        const selected = [
          value.packageName ? 1 : 0,
          value.workspace ? 1 : 0,
          value.fromPlanFile ? 1 : 0,
        ].reduce((sum, item) => sum + item, 0);
        if (selected !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Specify exactly one scope: packageName, workspace=true, or fromPlanFile.",
          });
        }
      }),
      jsonSchema: {
        type: "object",
        properties: {
          cwd: { type: "string" },
          workspace: { type: "boolean" },
          packageName: { type: "string" },
          fromPlanFile: { type: "string" },
          includeChangelog: { type: "boolean" },
        },
      },
      call: async (args, context) => {
        const options: PredictOptions = {
          cwd: resolveString(args.cwd, serverOptions.cwd),
          workspace: resolveBoolean(args.workspace, serverOptions.workspace),
          packageName: args.packageName as string | undefined,
          fromPlanFile: args.fromPlanFile as string | undefined,
          includeChangelog: (args.includeChangelog as boolean | undefined) ?? true,
          failOnRisk: false,
          format: "json",
          jsonFile: undefined,
          concurrency: 16,
          registryTimeoutMs: 8000,
          registryRetries: 3,
          cacheTtlSeconds: 3600,
        };
        const result = await runPredictService(options, context);
        return wrapResult(result);
      },
    },
    {
      name: "rup_review",
      description: "Build a reviewed decision queue for dependency changes.",
      inputSchema: baseInputSchema.extend({
        securityOnly: z.boolean().optional(),
        risk: z.enum(["critical", "high", "medium", "low"]).optional(),
        diff: z.enum(["patch", "minor", "major", "latest"]).optional(),
        planFile: z.string().optional(),
        ...gitScopeSchema,
      }),
      jsonSchema: { type: "object", properties: { planFile: { type: "string" } } },
      call: async (args, context) => {
        const options: ReviewOptions = {
          ...defaultCheckOptions(serverOptions, args.cwd, args.workspace),
          securityOnly: (args.securityOnly as boolean | undefined) ?? false,
          risk: args.risk as ReviewOptions["risk"],
          diff: args.diff as ReviewOptions["diff"],
          applySelected: false,
          showChangelog: true,
          decisionPlanFile: args.planFile as string | undefined,
          queueFocus: "all",
          onlyChanged: false,
          affected: args.affected as boolean | undefined,
          staged: args.staged as boolean | undefined,
          baseRef: args.baseRef as string | undefined,
          headRef: args.headRef as string | undefined,
          sinceRef: args.sinceRef as string | undefined,
        };
        const result = await runReviewService(options, context);
        return wrapResult({
          summary: result.summary,
          items: result.items,
          decisionPlan: result.decisionPlan,
        });
      },
    },
    {
      name: "rup_audit",
      description: "Scan dependencies for CVEs using OSV.dev and GitHub advisories.",
      inputSchema: baseInputSchema.extend({
        severity: z.enum(["critical", "high", "medium", "low"]).optional(),
        sourceMode: z.enum(["auto", "osv", "github", "all"]).optional(),
        ...gitScopeSchema,
      }),
      jsonSchema: { type: "object", properties: { severity: { type: "string" } } },
      call: async (args, context) => {
        const options: AuditOptions = {
          cwd: resolveString(args.cwd, serverOptions.cwd),
          workspace: resolveBoolean(args.workspace, serverOptions.workspace),
          affected: args.affected as boolean | undefined,
          staged: args.staged as boolean | undefined,
          baseRef: args.baseRef as string | undefined,
          headRef: args.headRef as string | undefined,
          sinceRef: args.sinceRef as string | undefined,
          severity: args.severity as AuditOptions["severity"],
          fix: false,
          dryRun: false,
          commit: false,
          packageManager: "auto",
          reportFormat: "json",
          sourceMode: (args.sourceMode as AuditOptions["sourceMode"]) ?? "auto",
          jsonFile: undefined,
          concurrency: 16,
          registryTimeoutMs: 8000,
          silent: true,
        };
        const result = await runAuditService(options, context);
        return wrapResult(result);
      },
    },
    {
      name: "rup_upgrade",
      description: "Apply an approved decision plan with optional verification.",
      inputSchema: baseInputSchema.extend({
        fromPlanFile: z.string(),
        confirm: z.boolean(),
        install: z.boolean().optional(),
        sync: z.boolean().optional(),
        packageManager: z.enum(["auto", "bun", "npm", "pnpm", "yarn"]).optional(),
        verify: z.enum(["none", "install", "test", "install,test"]).optional(),
        testCommand: z.string().optional(),
      }),
      jsonSchema: { type: "object", required: ["fromPlanFile", "confirm"] },
      call: async (args, context) => {
        if (args.confirm !== true) {
          throw new McpToolError({
            code: "CONFIRMATION_REQUIRED",
            message: "Mutating tool rup_upgrade requires confirm=true.",
            retryable: false,
          });
        }
        const options: UpgradeOptions = {
          ...defaultUpgradeOptions(serverOptions, args.cwd, args.workspace),
          fromPlanFile: args.fromPlanFile as string,
          install: (args.install as boolean | undefined) ?? false,
          sync: (args.sync as boolean | undefined) ?? false,
          packageManager: (args.packageManager as UpgradeOptions["packageManager"]) ?? "auto",
          verify: (args.verify as UpgradeOptions["verify"]) ?? "none",
          testCommand: args.testCommand as string | undefined,
        };
        const result = await runUpgradeService(options, context);
        return wrapResult({
          changed: result.changed,
          summary: result.summary,
          updates: result.updates,
        });
      },
    },
    {
      name: "rup_health",
      description: "Return package maintenance health metrics.",
      inputSchema: baseInputSchema.extend({
        staleDays: z.number().int().positive().optional(),
        includeDeprecated: z.boolean().optional(),
        includeAlternatives: z.boolean().optional(),
      }),
      jsonSchema: { type: "object", properties: { staleDays: { type: "number" } } },
      call: async (args, context) => {
        const options: HealthOptions = {
          cwd: resolveString(args.cwd, serverOptions.cwd),
          workspace: resolveBoolean(args.workspace, serverOptions.workspace),
          affected: false,
          staged: false,
          baseRef: undefined,
          headRef: undefined,
          sinceRef: undefined,
          staleDays: (args.staleDays as number | undefined) ?? 365,
          includeDeprecated: (args.includeDeprecated as boolean | undefined) ?? true,
          includeAlternatives: (args.includeAlternatives as boolean | undefined) ?? false,
          reportFormat: "json",
          jsonFile: undefined,
          concurrency: 16,
          registryTimeoutMs: 8000,
        };
        const result = await runHealthService(options, context);
        return wrapResult(result);
      },
    },
    {
      name: "rup_bisect",
      description: "Find the version that introduced a breaking change.",
      inputSchema: z.object({
        cwd: z.string().optional(),
        packageName: z.string(),
        versionRange: z.string().optional(),
        testCommand: z.string().optional(),
        dryRun: z.boolean().optional(),
      }),
      jsonSchema: { type: "object", required: ["packageName"] },
      call: async (args, context) => {
        const options: BisectOptions = {
          cwd: resolveString(args.cwd, serverOptions.cwd),
          packageName: args.packageName as string,
          versionRange: args.versionRange as string | undefined,
          testCommand: (args.testCommand as string | undefined) ?? "",
          concurrency: 4,
          registryTimeoutMs: 8000,
          cacheTtlSeconds: 3600,
          dryRun: (args.dryRun as boolean | undefined) ?? false,
        };
        const result = await runBisectService(options, context);
        return wrapResult(result);
      },
    },
    {
      name: "rup_resolve",
      description: "Resolve peer dependency conflicts.",
      inputSchema: baseInputSchema.extend({
        afterUpdate: z.boolean().optional(),
        ...gitScopeSchema,
      }),
      jsonSchema: { type: "object", properties: { afterUpdate: { type: "boolean" } } },
      call: async (args, context) => {
        const options: ResolveOptions = {
          cwd: resolveString(args.cwd, serverOptions.cwd),
          workspace: resolveBoolean(args.workspace, serverOptions.workspace),
          affected: args.affected as boolean | undefined,
          staged: args.staged as boolean | undefined,
          baseRef: args.baseRef as string | undefined,
          headRef: args.headRef as string | undefined,
          sinceRef: args.sinceRef as string | undefined,
          afterUpdate: (args.afterUpdate as boolean | undefined) ?? false,
          safe: false,
          jsonFile: undefined,
          concurrency: 12,
          registryTimeoutMs: 10000,
          cacheTtlSeconds: 3600,
          silent: true,
        };
        const result = await runResolveService(options, context);
        return wrapResult(result);
      },
    },
    {
      name: "rup_baseline",
      description: "Save or diff a dependency baseline snapshot.",
      inputSchema: baseInputSchema.extend({
        action: z.enum(["save", "check"]),
        filePath: z.string(),
        includeKinds: z.array(
          z.enum(["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]),
        ).optional(),
      }),
      jsonSchema: { type: "object", required: ["action", "filePath"] },
      call: async (args, context) => {
        const options: BaselineOptions = {
          cwd: resolveString(args.cwd, serverOptions.cwd),
          workspace: resolveBoolean(args.workspace, serverOptions.workspace),
          includeKinds:
            (args.includeKinds as BaselineOptions["includeKinds"] | undefined) ??
            defaultCheckOptions(serverOptions).includeKinds,
          filePath: args.filePath as string,
          ci: false,
        };
        const result =
          args.action === "save"
            ? await saveBaselineService(options, context)
            : await diffBaselineService(options, context);
        return wrapResult(result);
      },
    },
    {
      name: "rup_explain",
      description: "Explain what changes in a specific dependency update.",
      inputSchema: z.object({
        cwd: z.string().optional(),
        workspace: z.boolean().optional(),
        packageName: z.string(),
        fromVersion: z.string().optional(),
        toVersion: z.string().optional(),
      }),
      jsonSchema: { type: "object", required: ["packageName"] },
      call: async (args, context) => {
        const options: ExplainOptions = {
          cwd: resolveString(args.cwd, serverOptions.cwd),
          workspace: resolveBoolean(args.workspace, serverOptions.workspace),
          packageName: args.packageName as string,
          fromVersion: args.fromVersion as string | undefined,
          toVersion: args.toVersion as string | undefined,
          format: "json",
          jsonFile: undefined,
          concurrency: 16,
          registryTimeoutMs: 8000,
          registryRetries: 3,
          cacheTtlSeconds: 3600,
        };
        const result = await runExplainService(options, context);
        return wrapResult(result);
      },
    },
  ];

  return definitions;
}

export function createMcpServiceContext(options: McpOptions): ServiceContext {
  return createServiceContext({
    cwd: options.cwd,
    mode: "mcp",
    silent: true,
    logLevel: options.logLevel,
  });
}

function defaultCheckOptions(
  serverOptions: McpOptions,
  cwd?: unknown,
  workspace?: unknown,
): CheckOptions {
  return {
    cwd: resolveString(cwd, serverOptions.cwd),
    target: "latest",
    filter: undefined,
    reject: undefined,
    cacheTtlSeconds: 3600,
    includeKinds: [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ],
    ci: false,
    format: "json",
    workspace: resolveBoolean(workspace, serverOptions.workspace),
    jsonFile: undefined,
    githubOutputFile: undefined,
    sarifFile: undefined,
    concurrency: 16,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    offline: false,
    stream: false,
    policyFile: undefined,
    prReportFile: undefined,
    failOn: "none",
    maxUpdates: undefined,
    fixPr: false,
    fixBranch: "chore/rainy-updates",
    fixCommitMessage: undefined,
    fixDryRun: false,
    fixPrNoCheckout: false,
    fixPrBatchSize: undefined,
    noPrReport: true,
    logLevel: "info",
    groupBy: "none",
    groupMax: undefined,
    cooldownDays: undefined,
    prLimit: undefined,
    onlyChanged: false,
    affected: false,
    staged: false,
    baseRef: undefined,
    headRef: undefined,
    sinceRef: undefined,
    ciProfile: "minimal",
    lockfileMode: "preserve",
    interactive: false,
    showImpact: true,
    showHomepage: true,
    decisionPlanFile: undefined,
    verify: "none",
    testCommand: undefined,
    verificationReportFile: undefined,
    ciGate: "check",
  };
}

function defaultUpgradeOptions(
  serverOptions: McpOptions,
  cwd?: unknown,
  workspace?: unknown,
): UpgradeOptions {
  return {
    ...defaultCheckOptions(serverOptions, cwd, workspace),
    install: false,
    packageManager: "auto",
    sync: false,
    fromPlanFile: undefined,
  };
}

function resolveBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function resolveString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function wrapResult<T>(structuredContent: T): McpToolCallResult<T> {
  return {
    content: [
      {
        type: "text",
        text: stableStringify(structuredContent, 2),
      },
    ],
    structuredContent,
  };
}

export function listMcpTools(serverOptions: McpOptions): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> {
  return createMcpTools(serverOptions).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.jsonSchema,
  }));
}

export async function callMcpTool(
  serverOptions: McpOptions,
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<McpToolCallResult<unknown>> {
  const tool = createMcpTools(serverOptions).find((entry) => entry.name === name);
  if (!tool) {
    throw new McpToolError({
      code: "UNKNOWN_TOOL",
      message: `Unknown MCP tool: ${name}`,
      retryable: false,
      details: { availableTools: createMcpTools(serverOptions).map((entry) => entry.name) },
    });
  }

  const parsed = tool.inputSchema.safeParse(args ?? {});
  if (!parsed.success) {
    throw new McpToolError({
      code: "INVALID_PARAMS",
      message: `Invalid params for ${name}`,
      retryable: false,
      details: { issues: parsed.error.issues },
    });
  }

  const context = createMcpServiceContext(serverOptions);
  return withTimeout(
    tool.call(parsed.data as Record<string, unknown>, context),
    serverOptions.toolTimeoutMs,
    name,
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new McpToolError({
          code: "TOOL_TIMEOUT",
          message: `Tool ${toolName} exceeded ${timeoutMs}ms timeout.`,
          retryable: true,
          details: { timeoutMs, toolName, serverVersion: CLI_VERSION },
        }),
      );
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
