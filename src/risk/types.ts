import type {
  HealthResult,
  LicenseResult,
  PackageUpdate,
  PeerConflict,
  RiskAssessment,
  UnusedDependency,
  CveAdvisory,
} from "../types/index.js";

export interface RiskInput {
  update: PackageUpdate;
  advisories: CveAdvisory[];
  health?: HealthResult["metrics"][number];
  peerConflicts: PeerConflict[];
  licenseViolation: boolean;
  unusedIssues: UnusedDependency[];
}

export interface RiskContext {
  knownPackageNames: ReadonlySet<string>;
}

export interface RiskSignalResult {
  assessment: RiskAssessment;
}
