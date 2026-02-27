import { expect, test } from "bun:test";
import { planFixPrBatches } from "../src/core/fix-pr-batch.js";

test("planFixPrBatches groups branches by batch size", () => {
  const plans = planFixPrBatches(
    [
      { key: "@scope-a", items: [] },
      { key: "@scope-b", items: [] },
      { key: "unscoped", items: [] },
    ],
    "chore/rainy-updates",
    2,
  );

  expect(plans.length).toBe(2);
  expect(plans[0]?.branchName).toBe("chore/rainy-updates-batch-1");
  expect(plans[1]?.branchName).toBe("chore/rainy-updates-unscoped");
});
