import { expect, test } from "bun:test";
import { $ } from "bun";
// writeFile was here;
import os from "os";
import { $ } from "bun";
import path from "path";
import { loadPolicy } from "../src/config/policy.js";

test("loadPolicy reads package rules and ignore patterns", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-policy-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  const policyPath = path.join(dir, ".rainyupdates-policy.json");
  await (async (p, c) => await Bun.write(p, c))(
    policyPath,
    JSON.stringify({
      ignore: ["@types/*"],
      cooldownDays: 14,
      packageRules: {
        react: { maxTarget: "minor", group: "frontend", priority: 10, target: "patch", autofix: false },
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
  expect(policy.packageRules.get("react")?.target).toBe("patch");
  expect(policy.packageRules.get("react")?.autofix).toBe(false);
});
