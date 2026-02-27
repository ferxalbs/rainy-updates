import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadPolicy } from "../src/config/policy.js";

test("loadPolicy reads package rules and ignore patterns", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-policy-"));
  const policyPath = path.join(dir, ".rainyupdates-policy.json");
  await writeFile(
    policyPath,
    JSON.stringify({
      ignore: ["@types/*"],
      cooldownDays: 14,
      packageRules: {
        react: { maxTarget: "minor", group: "frontend", priority: 10 },
      },
    }),
    "utf8",
  );

  const policy = await loadPolicy(dir);
  expect(policy.ignorePatterns[0]).toBe("@types/*");
  expect(policy.cooldownDays).toBe(14);
  expect(policy.packageRules.get("react")?.maxTarget).toBe("minor");
  expect(policy.packageRules.get("react")?.group).toBe("frontend");
  expect(policy.packageRules.get("react")?.priority).toBe(10);
});
