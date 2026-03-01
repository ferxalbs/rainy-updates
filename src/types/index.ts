export type DependencyKind =
  | "dependencies"
  | "devDependencies"
  | "optionalDependencies"
  | "peerDependencies";

export type TargetLevel = "patch" | "minor" | "major" | "latest";
export type GroupBy = "none" | "name" | "scope" | "kind" | "risk";
export type CiProfile = "minimal" | "strict" | "enterprise";
export type LockfileMode = "preserve" | "update" | "error";
export type Verdict = "safe" | "review" | "blocked" | "actionable";
export type RiskLevel = "critical" | "high" | "medium" | "low";
export type RiskCategory =
  | "known-vulnerability"
  | "behavioral-risk"
  | "operational-health";
export type MaintainerChurnStatus = "unknown" | "stable" | "elevated-change";
export type PolicyAction = "allow" | "review" | "block" | "monitor";
export type DecisionState = "safe" | "review" | "blocked" | "actionable";

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
  interactive: boolean;
  showImpact: boolean;
  showHomepage: boolean;
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

export interface ImpactScore {
  rank: "critical" | "high" | "medium" | "low";
  score: number; // 0–100 composite
  factors: {
    diffTypeWeight: number; // patch=1, minor=2, major=4
    hasAdvisory: boolean;
    affectedWorkspaceCount: number;
  };
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
  impactScore?: ImpactScore;
  homepage?: string;
  repository?: string;
  publishedAt?: string;
  publishAgeDays?: number | null;
  hasInstallScript?: boolean;
  maintainerCount?: number | null;
  maintainerChurn?: MaintainerChurnStatus;
  riskLevel?: RiskLevel;
  riskScore?: number;
  riskReasons?: string[];
  riskCategories?: RiskCategory[];
  recommendedAction?: string;
  advisoryCount?: number;
  peerConflictSeverity?: "none" | PeerConflictSeverity;
  licenseStatus?: "allowed" | "review" | "denied";
  healthStatus?: "healthy" | HealthFlag;
  policyAction?: PolicyAction;
  decisionState?: DecisionState;
  releaseNotesSummary?: ReleaseNotesSummary;
  engineStatus?: EngineStatus;
  workspaceGroup?: string;
  groupKey?: string;
  selectedByDefault?: boolean;
  blockedReason?: string;
  monitorReason?: string;
}

export interface ReleaseNotesSummary {
  source: "github-release" | "changelog-file" | "none";
  title: string;
  excerpt: string;
}

export interface EngineStatus {
  state: "compatible" | "review" | "blocked" | "unknown";
  required?: string;
  current?: string;
  reason?: string;
}

export interface ArtifactManifest {
  runId: string;
  createdAt: string;
  command: string;
  projectPath: string;
  ciProfile: CiProfile;
  artifactManifestPath: string;
  outputs: {
    jsonFile?: string;
    githubOutputFile?: string;
    sarifFile?: string;
    prReportFile?: string;
  };
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
  verdict?: Verdict;
  interactiveSession?: boolean;
  riskPackages?: number;
  securityPackages?: number;
  peerConflictPackages?: number;
  licenseViolationPackages?: number;
  privateRegistryPackages?: number;
  runId?: string;
  artifactManifest?: string;
  policyActionCounts?: Record<PolicyAction, number>;
  blockedPackages?: number;
  reviewPackages?: number;
  monitorPackages?: number;
  decisionPackages?: number;
  releaseVolatilityPackages?: number;
  engineConflictPackages?: number;
  degradedSources?: string[];
  cacheBackend?: "sqlite" | "file";
  binaryRecommended?: boolean;
  gaReady?: boolean;
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
export type AuditReportFormat = "table" | "json" | "summary";
export type AuditSourceMode = "auto" | "osv" | "github" | "all";
export type AuditSourceName = "osv" | "github";
export type AuditSourceStatusLevel = "ok" | "partial" | "failed";

export interface AuditOptions {
  cwd: string;
  workspace: boolean;
  severity?: AuditSeverity;
  fix: boolean;
  dryRun: boolean;
  commit: boolean;
  packageManager: "auto" | "npm" | "pnpm" | "bun" | "yarn";
  reportFormat: AuditReportFormat;
  sourceMode: AuditSourceMode;
  jsonFile?: string;
  concurrency: number;
  registryTimeoutMs: number;
  silent?: boolean;
}

export interface CveAdvisory {
  cveId: string;
  packageName: string;
  currentVersion: string | null;
  severity: AuditSeverity;
  vulnerableRange: string;
  patchedVersion: string | null;
  title: string;
  url: string;
  sources: readonly AuditSourceName[];
}

export interface AuditPackageSummary {
  packageName: string;
  currentVersion: string | null;
  severity: AuditSeverity;
  advisoryCount: number;
  patchedVersion: string | null;
  sources: readonly AuditSourceName[];
}

export interface AuditSourceStatus {
  source: AuditSourceName;
  status: AuditSourceStatusLevel;
  attemptedTargets: number;
  successfulTargets: number;
  failedTargets: number;
  advisoriesFound: number;
  message?: string;
}

export interface AuditResult {
  advisories: CveAdvisory[];
  packages: AuditPackageSummary[];
  autoFixable: number;
  errors: string[];
  warnings: string[];
  sourcesUsed: AuditSourceName[];
  sourceHealth: AuditSourceStatus[];
  resolution: {
    lockfile: number;
    manifest: number;
    unresolved: number;
  };
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

// ─── v0.5.4 command types ────────────────────────────────────────────────────

// resolve ─────────────────────────────────────────────────────────────────────

export interface PeerNode {
  name: string;
  resolvedVersion: string;
  peerRequirements: Map<string, string>;
}

export interface PeerGraph {
  nodes: Map<string, PeerNode>;
  roots: string[];
}

export type PeerConflictSeverity = "error" | "warning";

export interface PeerConflict {
  requester: string;
  peer: string;
  requiredRange: string;
  resolvedVersion: string;
  severity: PeerConflictSeverity;
  suggestion: string;
}

export interface ResolveOptions {
  cwd: string;
  workspace: boolean;
  afterUpdate: boolean; // simulate pending check updates before applying
  safe: boolean;
  jsonFile?: string;
  concurrency: number;
  registryTimeoutMs: number;
  cacheTtlSeconds: number;
  silent?: boolean;
}

export interface ResolveResult {
  conflicts: PeerConflict[];
  errorConflicts: number;
  warningConflicts: number;
  errors: string[];
  warnings: string[];
}

export interface RiskSignal {
  packageName: string;
  code: string;
  weight: number;
  category: RiskCategory;
  level: RiskLevel;
  reasons: string[];
}

export interface RiskFactor {
  code: string;
  weight: number;
  category: RiskCategory;
  message: string;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  reasons: string[];
  categories: RiskCategory[];
  recommendedAction: string;
  factors: RiskFactor[];
}

export interface ReviewItem {
  update: PackageUpdate;
  advisories: CveAdvisory[];
  health?: PackageHealthMetric;
  peerConflicts: PeerConflict[];
  license?: PackageLicense;
  unusedIssues: UnusedDependency[];
  selected: boolean;
}

export interface ReviewResult {
  projectPath: string;
  target: TargetLevel;
  summary: Summary;
  analysis: AnalysisBundle;
  items: ReviewItem[];
  updates: PackageUpdate[];
  errors: string[];
  warnings: string[];
}

export interface ReviewOptions extends CheckOptions {
  securityOnly: boolean;
  risk?: RiskLevel;
  diff?: TargetLevel;
  applySelected: boolean;
  showChangelog?: boolean;
}

export interface DoctorOptions extends CheckOptions {
  verdictOnly: boolean;
  includeChangelog?: boolean;
}

export interface DoctorResult {
  verdict: Verdict;
  summary: Summary;
  review: ReviewResult;
  primaryFindings: string[];
  recommendedCommand: string;
}

export interface AnalysisBundle {
  check: CheckResult;
  audit: AuditResult;
  resolve: ResolveResult;
  health: HealthResult;
  licenses: LicenseResult;
  unused: UnusedResult;
  items: ReviewItem[];
  degradedSources: string[];
}

// dashboard ───────────────────────────────────────────────────────────────────

export interface DashboardOptions extends CheckOptions {
  // Add any specific options here, e.g. default view
  view?: "dependencies" | "security" | "health";
}

export interface DashboardResult {
  completed: boolean;
  errors: string[];
  warnings: string[];
}

// unused ──────────────────────────────────────────────────────────────────────

export type UnusedKind = "declared-not-imported" | "imported-not-declared";

export interface UnusedDependency {
  name: string;
  kind: UnusedKind;
  declaredIn?: string; // package.json field name
  importedFrom?: string; // relative source file
}

export interface UnusedOptions {
  cwd: string;
  workspace: boolean;
  srcDirs: string[]; // defaults: ['src', '.']
  includeDevDependencies: boolean;
  fix: boolean;
  dryRun: boolean;
  jsonFile?: string;
  concurrency: number;
}

export interface UnusedResult {
  unused: UnusedDependency[];
  missing: UnusedDependency[];
  totalUnused: number;
  totalMissing: number;
  errors: string[];
  warnings: string[];
}

// licenses ────────────────────────────────────────────────────────────────────

export interface PackageLicense {
  name: string;
  version: string;
  license: string;
  spdxExpression: string | null;
  homepage?: string;
  repository?: string;
}

export interface SbomDocument {
  spdxVersion: "SPDX-2.3";
  dataLicense: "CC0-1.0";
  name: string;
  documentNamespace: string;
  packages: SbomPackage[];
  relationships: SbomRelationship[];
}

export interface SbomPackage {
  SPDXID: string;
  name: string;
  versionInfo: string;
  downloadLocation: string;
  licenseConcluded: string;
  licenseDeclared: string;
  copyrightText: string;
}

export interface SbomRelationship {
  spdxElementId: string;
  relationshipType: "DESCRIBES" | "DEPENDS_ON";
  relatedSpdxElement: string;
}

export interface LicenseOptions {
  cwd: string;
  workspace: boolean;
  allow?: string[];
  deny?: string[];
  sbomFile?: string;
  jsonFile?: string;
  diffMode: boolean;
  concurrency: number;
  registryTimeoutMs: number;
  cacheTtlSeconds: number;
}

export interface LicenseResult {
  packages: PackageLicense[];
  violations: PackageLicense[];
  totalViolations: number;
  errors: string[];
  warnings: string[];
}

// snapshot ────────────────────────────────────────────────────────────────────

export interface SnapshotEntry {
  id: string;
  label: string;
  createdAt: number; // unix timestamp ms
  manifests: Record<string, string>; // packagePath → JSON string of package.json
  lockfileHashes: Record<string, string>; // packagePath → sha256 of lockfile
}

export type SnapshotAction = "save" | "list" | "restore" | "diff";

export interface SnapshotOptions {
  cwd: string;
  workspace: boolean;
  action: SnapshotAction;
  label?: string;
  snapshotId?: string;
  storeFile?: string;
}

export interface SnapshotResult {
  action: SnapshotAction;
  snapshotId?: string;
  label?: string;
  entries?: Array<{ id: string; label: string; createdAt: string }>;
  diff?: Array<{ name: string; from: string; to: string }>;
  errors: string[];
  warnings: string[];
}

export interface GaOptions {
  cwd: string;
  workspace: boolean;
  jsonFile?: string;
}

export interface GaCheck {
  name:
    | "package-manager"
    | "workspace-discovery"
    | "lockfile"
    | "cache-backend"
    | "dist-build"
    | "benchmark-gates"
    | "docs-contract";
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface GaResult {
  ready: boolean;
  projectPath: string;
  packageManager: "npm" | "pnpm" | "unknown";
  workspacePackages: number;
  cacheBackend: "sqlite" | "file";
  checks: GaCheck[];
  warnings: string[];
  errors: string[];
}
