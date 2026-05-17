import { expect, test } from "bun:test";
import { $ } from "bun";
// readFile, writeFile was here;
import os from "node:os";
import { $ } from "bun";
import path from "node:path";
import { diffBaseline, saveBaseline } from "../src/core/baseline.js";

test("baseline save and diff detects changed dependency ranges", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-baseline-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  const packageJsonPath = path.join(dir, "package.json");

  await (async (p, c) => await Bun.write(p, c))(
    packageJsonPath,
    JSON.stringify({ name: "demo", dependencies: { react: "^18.2.0" } }, null, 2),
    "utf8",
  );

  const baselinePath = path.join(dir, ".cache", "baseline.json");
  const saved = await saveBaseline({
    cwd: dir,
    workspace: false,
    includeKinds: ["dependencies"],
    filePath: baselinePath,
    ci: false,
  });

  expect(saved.entries).toBe(1);
  expect((await Bun.file(baselinePath).text()).includes('"version": 1')).toBe(true);

  await (async (p, c) => await Bun.write(p, c))(
    packageJsonPath,
    JSON.stringify({ name: "demo", dependencies: { react: "^19.0.0" } }, null, 2),
    "utf8",
  );

  const diff = await diffBaseline({
    cwd: dir,
    workspace: false,
    includeKinds: ["dependencies"],
    filePath: baselinePath,
    ci: true,
  });

  expect(diff.changed.length).toBe(1);
  expect(diff.changed[0]?.before.range).toBe("^18.2.0");
  expect(diff.changed[0]?.after.range).toBe("^19.0.0");
  expect(diff.added.length).toBe(0);
  expect(diff.removed.length).toBe(0);
});
