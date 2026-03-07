import type {
  AnalysisBundle,
  CheckOptions,
  DoctorOptions,
  ReviewOptions,
} from "../types/index.js";
import { check } from "./check.js";
import {
  toAuditOptions,
  toHealthOptions,
  toLicenseOptions,
  toResolveOptions,
  toUnusedOptions,
} from "./analysis/options.js";
import { buildReviewItems } from "./analysis/review-items.js";
import { runSilenced } from "./analysis/run-silenced.js";
import { runAuditService } from "../services/audit.js";
import { runResolveService } from "../services/resolve.js";
import { runHealthService } from "../services/health.js";

export async function buildAnalysisBundle(
  options: ReviewOptions | DoctorOptions | CheckOptions,
  config: { includeChangelog?: boolean } = {},
): Promise<AnalysisBundle> {
  const baseCheckOptions: CheckOptions = {
    ...options,
    interactive: false,
    showImpact: true,
    showHomepage: true,
  };
  const checkResult = await check(baseCheckOptions);

  const [auditResult, resolveResult, healthResult, licenseResult, unusedResult] =
    await runSilenced(() =>
      Promise.all([
        runAuditService(toAuditOptions(options)),
        runResolveService(toResolveOptions(options)),
        runHealthService(toHealthOptions(options)),
        import("../commands/licenses/runner.js").then((mod) =>
          mod.runLicenses(toLicenseOptions(options)),
        ),
        import("../commands/unused/runner.js").then((mod) =>
          mod.runUnused(toUnusedOptions(options)),
        ),
      ]),
    );

  const items = await buildReviewItems(
    checkResult.updates,
    auditResult,
    resolveResult,
    healthResult,
    licenseResult,
    unusedResult,
    config,
  );

  return {
    check: checkResult,
    audit: auditResult,
    resolve: resolveResult,
    health: healthResult,
    licenses: licenseResult,
    unused: unusedResult,
    items,
    degradedSources: auditResult.sourceHealth
      .filter((source) => source.status !== "ok")
      .map((source) => source.source),
  };
}
