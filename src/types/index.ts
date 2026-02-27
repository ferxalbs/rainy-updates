export type DependencyKind =
  | "dependencies"
  | "devDependencies"
  | "optionalDependencies"
  | "peerDependencies";

export type TargetLevel = "patch" | "minor" | "major" | "latest";
export type GroupBy = "none" | "name" | "scope" | "kind" | "risk";
export type CiProfile = "minimal" | "strict" | "enterprise";

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
  offline: boolean;
  policyFile?: string;
  prReportFile?: string;
  failOn?: FailOnLevel;
  maxUpdates?: number;
  fixPr?: boolean;
  fixBranch?: string;
  fixCommitMessage?: string;
  fixDryRun?: boolean;
  fixPrNoCheckout?: boolean;
  noPrReport?: boolean;
  logLevel: LogLevel;
  groupBy: GroupBy;
  groupMax?: number;
  cooldownDays?: number;
  prLimit?: number;
  onlyChanged: boolean;
  ciProfile: CiProfile;
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
  groupedUpdates: number;
  cooldownSkipped: number;
  ciProfile: CiProfile;
  prLimitHit: boolean;
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
