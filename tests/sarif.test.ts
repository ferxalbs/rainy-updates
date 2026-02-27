import { expect, test } from "bun:test";
import { createSarifReport } from "../src/output/sarif.js";
import type { CheckResult } from "../src/types/index.js";

test("createSarifReport includes updates and errors", () => {
  const input: CheckResult = {
    projectPath: "/tmp/project",
    packagePaths: ["/tmp/project"],
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
    },
    updates: [
      {
        packagePath: "/tmp/project",
        name: "react",
        kind: "dependencies",
        fromRange: "^18.2.0",
        toRange: "^19.0.0",
        toVersionResolved: "19.0.0",
        diffType: "major",
        filtered: false,
      },
    ],
    errors: ["sample error"],
    warnings: [],
  };

  const sarif = createSarifReport(input);
  const json = JSON.stringify(sarif);
  expect(json.includes("dependency-update")).toBe(true);
  expect(json.includes("runtime-error")).toBe(true);
  expect(json.includes("react")).toBe(true);
});
