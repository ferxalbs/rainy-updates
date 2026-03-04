import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("generate-distribution-manifests emits Homebrew and Scoop metadata", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "rainy-distribution-"));
  const assetsDir = path.join(tempDir, "assets");
  const outputDir = path.join(tempDir, "out");

  await mkdir(assetsDir, { recursive: true });

  const fixtures: Array<[string, string]> = [
    ["rup-v0.6.2-macos-arm64.tar.gz.sha256", "a".repeat(64)],
    ["rup-v0.6.2-macos-x64.tar.gz.sha256", "b".repeat(64)],
    ["rup-v0.6.2-linux-arm64.tar.gz.sha256", "c".repeat(64)],
    ["rup-v0.6.2-linux-x64.tar.gz.sha256", "d".repeat(64)],
    ["rup-v0.6.2-windows-x64.zip.sha256", "e".repeat(64)],
  ];

  await Promise.all(
    fixtures.map(([fileName, hash]) =>
      writeFile(path.join(assetsDir, fileName), `${hash}  ${fileName}\n`, "utf8"),
    ),
  );

  const proc = Bun.spawn(
    [
      "bun",
      "scripts/generate-distribution-manifests.mjs",
      "--version",
      "0.6.2",
      "--repo",
      "ferxalbs/rainy-updates",
      "--assets-dir",
      assetsDir,
      "--output-dir",
      outputDir,
    ],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const exitCode = await proc.exited;
  expect(exitCode).toBe(0);

  const formula = await readFile(path.join(outputDir, "homebrew", "rup.rb"), "utf8");
  const scoop = await readFile(path.join(outputDir, "scoop", "rup.json"), "utf8");

  expect(formula).toContain('version "0.6.2"');
  expect(formula).toContain("rup-v0.6.2-macos-arm64.tar.gz");
  expect(formula).toContain("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

  expect(scoop).toContain('"version": "0.6.2"');
  expect(scoop).toContain("rup-v0.6.2-windows-x64.zip");
  expect(scoop).toContain("eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
});
