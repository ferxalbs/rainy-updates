import { expect, test } from "bun:test";
import { $ } from "bun";
// mkdir, writeFile was here;
import os from "os";
import { $ } from "bun";
import path from "path";
import type { ReviewItem } from "../src/types/index.js";
import { applyReachabilitySignalsToReviewItems } from "../src/services/reachability.js";

test("applyReachabilitySignalsToReviewItems marks imported advisory package as reachable", async () => {
  const cwd = await (async () => { const d = path.join(os.tmpdir(), "rainy-reachability-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
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
  await $`mkdir -p ${path.join(cwd, "src")}`;
  await (async (p, c) => await Bun.write(p, c))(path.join(cwd, "src", "index.ts"), "import _ from 'lodash';\nconsole.log(_);\n");

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
