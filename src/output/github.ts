import { promises as fs } from "node:fs";
import path from "node:path";
import type { CheckResult } from "../types/index.js";

export async function writeGitHubOutput(filePath: string, result: CheckResult): Promise<void> {
  const lines = [
    `updates_found=${result.summary.updatesFound}`,
    `errors_count=${result.errors.length}`,
    `warnings_count=${result.warnings.length}`,
    `checked_dependencies=${result.summary.checkedDependencies}`,
    `scanned_packages=${result.summary.scannedPackages}`,
  ];

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, lines.join("\n") + "\n", "utf8");
}

export function renderGitHubAnnotations(result: CheckResult): string {
  const lines: string[] = [];

  for (const update of result.updates) {
    lines.push(
      `::notice title=Dependency Update::${update.name} ${update.fromRange} -> ${update.toRange} (${update.packagePath})`,
    );
  }

  for (const warning of result.warnings) {
    lines.push(`::warning title=Rainy Updates::${warning}`);
  }

  for (const error of result.errors) {
    lines.push(`::error title=Rainy Updates::${error}`);
  }

  if (lines.length === 0) {
    lines.push("::notice title=Rainy Updates::No updates found");
  }

  return lines.join("\n");
}
