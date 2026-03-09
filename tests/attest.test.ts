import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runAttestService } from "../src/services/attest.js";

test("attest service passes when provenance and signing artifacts are present", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-attest-pass-"));
  await mkdir(path.join(cwd, ".github", "workflows"), { recursive: true });
  await mkdir(path.join(cwd, ".artifacts"), { recursive: true });
  await mkdir(path.join(cwd, "dist"), { recursive: true });

  await writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({ name: "attest-fixture", version: "1.0.0", publishConfig: { provenance: true } }),
    "utf8",
  );
  await writeFile(
    path.join(cwd, ".github", "workflows", "release.yml"),
    "name: release\njobs:\n  publish:\n    steps:\n      - run: slsa-generator\n",
    "utf8",
  );
  await writeFile(path.join(cwd, ".artifacts", "sbom.spdx.json"), "{}", "utf8");
  await writeFile(path.join(cwd, ".artifacts", "decision-plan.json"), "{}", "utf8");
  await writeFile(path.join(cwd, "dist", "checksums.txt"), "sha256 demo", "utf8");

  const result = await runAttestService({
    cwd,
    workspace: false,
    action: "verify",
    requireProvenance: true,
    requireSbom: true,
    requireSigning: true,
    format: "json",
    jsonFile: undefined,
  });

  expect(result.passed).toBe(true);
  expect(result.policyAction).toBe("allow");
  expect(result.checks.some((check) => check.id === "publish-provenance" && check.status === "pass")).toBe(true);
});

test("attest service blocks when required checks fail", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-attest-fail-"));
  await writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({ name: "attest-fixture", version: "1.0.0" }),
    "utf8",
  );

  const result = await runAttestService({
    cwd,
    workspace: false,
    action: "verify",
    requireProvenance: true,
    requireSbom: true,
    requireSigning: true,
    format: "json",
    jsonFile: undefined,
  });

  expect(result.passed).toBe(false);
  expect(result.policyAction).toBe("block");
  expect(result.checks.some((check) => check.status === "fail")).toBe(true);
});
