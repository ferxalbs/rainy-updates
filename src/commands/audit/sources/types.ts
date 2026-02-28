import type {
  AuditOptions,
  AuditSourceName,
  CveAdvisory,
} from "../../../types/index.js";
import type { AuditTarget } from "../targets.js";

export interface AuditSourceFetchResult {
  advisories: CveAdvisory[];
  warnings: string[];
}

export interface AuditSourceAdapter {
  name: AuditSourceName;
  fetch(
    targets: AuditTarget[],
    options: Pick<AuditOptions, "concurrency" | "registryTimeoutMs">,
  ): Promise<AuditSourceFetchResult>;
}
