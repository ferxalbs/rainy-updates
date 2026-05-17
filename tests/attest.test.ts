import { expect, test } from "bun:test";
import { $ } from "bun";
// mkdir, writeFile was here;
import os from "os";
import { $ } from "bun";
import path from "path";
import { runAttestService } from "../src/services/attest.js";

test("attest service passes when provenance and signing artifacts are present", async () => {
  const cwd = await (async () => { const d = path.join(os.tmpdir(), "rainy-attest-pass-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await $`mkdir -p ${path.join(cwd, ".github", "workflows")}`;
  await $`mkdir -p ${path.join(cwd, ".artifacts")}`;
  await $`mkdir -p ${path.join(cwd, "dist")}`;

  await (async (p, c) => await Bun.write(p, c))(
    path.join(cwd, "package.json"),
    JSON.stringify({ name: "attest-fixture", version: "1.0.0", publishConfig: { provenance: true } }),
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(
    path.join(cwd, ".github", "workflows", "release.yml"),
    "name: release\njobs:\n  publish:\n    steps:\n      - run: slsa-generator\n",
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(path.join(cwd, ".artifacts", "sbom.spdx.json"), "{}");
  await (async (p, c) => await Bun.write(p, c))(path.join(cwd, ".artifacts", "decision-plan.json"), "{}");
  await (async (p, c) => await Bun.write(p, c))(path.join(cwd, "dist", "checksums.txt"), "sha256 demo");

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
  const cwd = await (async () => { const d = path.join(os.tmpdir(), "rainy-attest-fail-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
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
