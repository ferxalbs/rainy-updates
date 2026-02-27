import { expect, test } from "bun:test";
import { renderPrReport } from "../src/output/pr-report.js";
import type { CheckResult } from "../src/types/index.js";

test("renderPrReport includes markdown table", () => {
  const result: CheckResult = {
    projectPath: "/tmp/x",
    packagePaths: ["/tmp/x"],
    packageManager: "npm",
    target: "latest",
    timestamp: new Date().toISOString(),
    summary: {
      scannedPackages: 1,
      totalDependencies: 1,
      checkedDependencies: 1,
      updatesFound: 1,
      upgraded: 0,
      skipped: 0,
      warmedPackages: 0,
    },
    updates: [
      {
        packagePath: "/tmp/x",
        name: "react",
        kind: "dependencies",
        fromRange: "^18.2.0",
        toRange: "^19.0.0",
        toVersionResolved: "19.0.0",
        diffType: "major",
        filtered: false,
      },
    ],
    errors: [],
    warnings: [],
  };

  const md = renderPrReport(result);
  expect(md.includes("# Dependency Update Report")).toBe(true);
  expect(md.includes("| Package | From | To | Type | Path |")).toBe(true);
  expect(md.includes("react")).toBe(true);
});
