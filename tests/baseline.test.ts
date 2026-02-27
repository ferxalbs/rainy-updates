import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { diffBaseline, saveBaseline } from "../src/core/baseline.js";

test("baseline save and diff detects changed dependency ranges", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-baseline-"));
  const packageJsonPath = path.join(dir, "package.json");

  await writeFile(
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
  expect((await readFile(baselinePath, "utf8")).includes('"version": 1')).toBe(true);

  await writeFile(
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
