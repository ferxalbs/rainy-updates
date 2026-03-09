import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ReviewItem } from "../src/types/index.js";
import { applyReachabilitySignalsToReviewItems } from "../src/services/reachability.js";

test("applyReachabilitySignalsToReviewItems marks imported advisory package as reachable", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-reachability-"));
  await writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({
      name: "reachability-fixture",
      version: "1.0.0",
      dependencies: {
        lodash: "^4.17.21",
      },
    }),
    "utf8",
  );
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src", "index.ts"), "import _ from 'lodash';\nconsole.log(_);\n", "utf8");

  const reviewItems: ReviewItem[] = [
    {
      update: {
        packagePath: cwd,
        name: "lodash",
        kind: "dependencies",
        fromRange: "^4.17.20",
        toRange: "^4.17.21",
        toVersionResolved: "4.17.21",
        diffType: "patch",
        filtered: false,
        autofix: true,
      },
      advisories: [
        {
          cveId: "CVE-2026-0001",
          packageName: "lodash",
          currentVersion: "4.17.20",
          severity: "high",
          vulnerableRange: "<4.17.21",
          patchedVersion: "4.17.21",
          title: "Prototype Pollution",
          url: "https://example.com",
          sources: ["osv"],
        },
      ],
      health: undefined,
      peerConflicts: [],
      license: undefined,
      unusedIssues: [],
      selected: true,
    },
  ];

  const enriched = await applyReachabilitySignalsToReviewItems(reviewItems, cwd, false);
  expect(enriched[0]?.update.reachability).toBe("reachable");
  expect((enriched[0]?.update.reachabilityConfidence ?? 0) > 0.8).toBe(true);
});
