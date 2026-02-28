import type {
  AuditOptions,
  AuditSourceStatus,
  AuditSourceName,
  CveAdvisory,
} from "../../../types/index.js";
import type { AuditTarget } from "../targets.js";

export interface AuditSourceTargetResult {
  advisories: CveAdvisory[];
  ok: boolean;
  error?: string;
}

export interface AuditSourceFetchResult {
  advisories: CveAdvisory[];
  warnings: string[];
  health: AuditSourceStatus;
}

export interface AuditSourceAggregateResult {
  advisories: CveAdvisory[];
  warnings: string[];
  sourceHealth: AuditSourceStatus[];
}

export interface AuditSourceAdapter {
  name: AuditSourceName;
  fetch(
    targets: AuditTarget[],
    options: Pick<AuditOptions, "concurrency" | "registryTimeoutMs">,
  ): Promise<AuditSourceFetchResult>;
}
