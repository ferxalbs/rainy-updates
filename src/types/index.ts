export type DependencyKind =
  | "dependencies"
  | "devDependencies"
  | "optionalDependencies"
  | "peerDependencies";

export type TargetLevel = "patch" | "minor" | "major" | "latest";
export type GroupBy = "none" | "name" | "scope" | "kind" | "risk";
export type CiProfile = "minimal" | "strict" | "enterprise";
export type LockfileMode = "preserve" | "update" | "error";

export type OutputFormat = "table" | "json" | "minimal" | "github" | "metrics";
export type FailOnLevel = "none" | "patch" | "minor" | "major" | "any";
export type LogLevel = "error" | "warn" | "info" | "debug";
export type FailReason =
  | "none"
  | "updates-threshold"
  | "severity-threshold"
  | "registry-failure"
  | "offline-cache-miss"
  | "policy-blocked";

export interface RunOptions {
  cwd: string;
  target: TargetLevel;
  filter?: string;
  reject?: string;
  cacheTtlSeconds: number;
  includeKinds: DependencyKind[];
  ci: boolean;
  format: OutputFormat;
  workspace: boolean;
  jsonFile?: string;
  githubOutputFile?: string;
  sarifFile?: string;
  concurrency: number;
  registryTimeoutMs: number;
  registryRetries: number;
  offline: boolean;
  stream: boolean;
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
  logLevel: LogLevel;
  groupBy: GroupBy;
  groupMax?: number;
  cooldownDays?: number;
  prLimit?: number;
  onlyChanged: boolean;
  ciProfile: CiProfile;
  lockfileMode: LockfileMode;
}

export interface CheckOptions extends RunOptions {}

export interface UpgradeOptions extends RunOptions {
  install: boolean;
  packageManager: "auto" | "npm" | "pnpm";
  sync: boolean;
}

export interface BaselineOptions {
  cwd: string;
  workspace: boolean;
  includeKinds: DependencyKind[];
  filePath: string;
  ci: boolean;
}

export interface PackageDependency {
  name: string;
  range: string;
  kind: DependencyKind;
}

export interface PackageUpdate {
  packagePath: string;
  name: string;
  kind: DependencyKind;
  fromRange: string;
  toRange: string;
  toVersionResolved: string;
  diffType: TargetLevel;
  filtered: boolean;
  autofix: boolean;
  reason?: string;
}

export interface Summary {
  contractVersion: "2";
  scannedPackages: number;
  totalDependencies: number;
  checkedDependencies: number;
  updatesFound: number;
  upgraded: number;
  skipped: number;
  warmedPackages: number;
  failReason: FailReason;
  errorCounts: {
    total: number;
    offlineCacheMiss: number;
    registryFailure: number;
    registryAuthFailure: number;
    other: number;
  };
  warningCounts: {
    total: number;
    staleCache: number;
    other: number;
  };
  durationMs: {
    total: number;
    discovery: number;
    registry: number;
    cache: number;
    render: number;
  };
  fixPrApplied: boolean;
  fixBranchName: string;
  fixCommitSha: string;
  fixPrBranchesCreated: number;
  groupedUpdates: number;
  cooldownSkipped: number;
  ciProfile: CiProfile;
  prLimitHit: boolean;
  streamedEvents: number;
  policyOverridesApplied: number;
}

export interface CheckResult {
  projectPath: string;
  packagePaths: string[];
  packageManager: "npm" | "pnpm" | "unknown";
  target: TargetLevel;
  timestamp: string;
  summary: Summary;
  updates: PackageUpdate[];
  errors: string[];
  warnings: string[];
}

export interface UpgradeResult extends CheckResult {
  changed: boolean;
}

export interface PackageManifest {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface CachedVersion {
  packageName: string;
  target: TargetLevel;
  latestVersion: string;
  availableVersions: string[];
  fetchedAt: number;
  ttlSeconds: number;
}

export interface VersionResolver {
  resolveLatestVersion(packageName: string): Promise<string | null>;
}

// ─── New v0.5.1 command types ──────────────────────────────────────────────

export type AuditSeverity = "critical" | "high" | "medium" | "low";
export type AuditReportFormat = "table" | "json";

export interface AuditOptions {
  cwd: string;
  workspace: boolean;
  severity?: AuditSeverity;
  fix: boolean;
  dryRun: boolean;
  reportFormat: AuditReportFormat;
  jsonFile?: string;
  concurrency: number;
  registryTimeoutMs: number;
}

export interface CveAdvisory {
  cveId: string;
  packageName: string;
  severity: AuditSeverity;
  vulnerableRange: string;
  patchedVersion: string | null;
  title: string;
  url: string;
}

export interface AuditResult {
  advisories: CveAdvisory[];
  autoFixable: number;
  errors: string[];
  warnings: string[];
}

export interface BisectOptions {
  cwd: string;
  packageName: string;
  versionRange?: string; // e.g. "1.0.0..2.5.3", defaults to all available
  testCommand: string; // --cmd value
  concurrency: number;
  registryTimeoutMs: number;
  cacheTtlSeconds: number;
  dryRun: boolean;
}

export type BisectOutcome = "good" | "bad" | "skip";

export interface BisectResult {
  packageName: string;
  breakingVersion: string | null;
  lastGoodVersion: string | null;
  totalVersionsTested: number;
  iterations: number;
}

export type HealthFlag = "stale" | "deprecated" | "archived" | "unmaintained";

export interface HealthOptions {
  cwd: string;
  workspace: boolean;
  staleDays: number; // default: 365
  includeDeprecated: boolean;
  includeAlternatives: boolean;
  reportFormat: "table" | "json";
  jsonFile?: string;
  concurrency: number;
  registryTimeoutMs: number;
}

export interface PackageHealthMetric {
  name: string;
  currentVersion: string;
  lastPublished: string | null;
  isDeprecated: boolean;
  deprecatedMessage?: string;
  isArchived: boolean;
  daysSinceLastRelease: number | null;
  flags: HealthFlag[];
}

export interface HealthResult {
  metrics: PackageHealthMetric[];
  totalFlagged: number;
  errors: string[];
  warnings: string[];
}
