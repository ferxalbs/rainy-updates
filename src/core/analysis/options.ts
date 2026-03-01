import type {
  AuditOptions,
  CheckOptions,
  HealthOptions,
  LicenseOptions,
  ResolveOptions,
  UnusedOptions,
} from "../../types/index.js";

export function toAuditOptions(options: CheckOptions): AuditOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    severity: undefined,
    fix: false,
    dryRun: true,
    commit: false,
    packageManager: "auto",
    reportFormat: "json",
    sourceMode: "auto",
    jsonFile: undefined,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
    silent: true,
  };
}

export function toResolveOptions(options: CheckOptions): ResolveOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    afterUpdate: true,
    safe: false,
    jsonFile: undefined,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
    cacheTtlSeconds: options.cacheTtlSeconds,
    silent: true,
  };
}

export function toHealthOptions(options: CheckOptions): HealthOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    staleDays: 365,
    includeDeprecated: true,
    includeAlternatives: false,
    reportFormat: "json",
    jsonFile: undefined,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
  };
}

export function toLicenseOptions(options: CheckOptions): LicenseOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    allow: undefined,
    deny: undefined,
    sbomFile: undefined,
    jsonFile: undefined,
    diffMode: false,
    concurrency: options.concurrency,
    registryTimeoutMs: options.registryTimeoutMs,
    cacheTtlSeconds: options.cacheTtlSeconds,
  };
}

export function toUnusedOptions(options: CheckOptions): UnusedOptions {
  return {
    cwd: options.cwd,
    workspace: options.workspace,
    srcDirs: ["src", "."],
    includeDevDependencies: true,
    fix: false,
    dryRun: true,
    jsonFile: undefined,
    concurrency: options.concurrency,
  };
}
