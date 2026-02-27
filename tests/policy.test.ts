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
      packageRules: {
        react: { maxTarget: "minor" },
      },
    }),
    "utf8",
  );

  const policy = await loadPolicy(dir);
  expect(policy.ignorePatterns[0]).toBe("@types/*");
  expect(policy.packageRules.get("react")?.maxTarget).toBe("minor");
});
