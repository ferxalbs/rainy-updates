export type DependencyKind =
  | "dependencies"
  | "devDependencies"
  | "optionalDependencies"
  | "peerDependencies";

export type TargetLevel = "patch" | "minor" | "major" | "latest";

export type OutputFormat = "table" | "json" | "minimal" | "github";

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
}

export interface CheckOptions extends RunOptions {}

export interface UpgradeOptions extends RunOptions {
  install: boolean;
  packageManager: "auto" | "npm" | "pnpm";
  sync: boolean;
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
  scannedPackages: number;
  totalDependencies: number;
  checkedDependencies: number;
  updatesFound: number;
  upgraded: number;
  skipped: number;
  warmedPackages: number;
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
  fetchedAt: number;
  ttlSeconds: number;
}

export interface VersionResolver {
  resolveLatestVersion(packageName: string): Promise<string | null>;
}
