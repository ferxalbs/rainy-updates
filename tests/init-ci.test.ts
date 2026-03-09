import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initCiWorkflow } from "../src/core/init-ci.js";

test("initCiWorkflow creates strict workflow file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-"));
  const result = await initCiWorkflow(dir, false, {
    mode: "strict",
    schedule: "weekly",
    target: "github",
  });
  expect(result.created).toBe(true);

  const content = await readFile(result.path, "utf8");
  expect(content.includes("Rainy Updates")).toBe(true);
  expect(content.includes("Warm cache")).toBe(true);
  expect(content.includes("Upload SARIF")).toBe(true);
  expect(content.includes("@rainy-updates/cli ci")).toBe(true);
  expect(content.includes("bunx --bun @rainy-updates/cli")).toBe(true);
  expect(content.includes("--mode strict")).toBe(true);
  expect(content.includes("--gate review")).toBe(true);
  expect(content.includes("--plan-file .artifacts/decision-plan.json")).toBe(true);
  expect(content.includes("Setup Node")).toBe(true);
});

test("initCiWorkflow uses pnpm install when pnpm lockfile exists", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-pnpm-"));
  await writeFile(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");

  const result = await initCiWorkflow(dir, true, {
    mode: "minimal",
    schedule: "off",
    target: "github",
  });
  const content = await readFile(result.path, "utf8");
  expect(content.includes("pnpm install --frozen-lockfile")).toBe(true);
  expect(content.includes("workflow_dispatch")).toBe(true);
});

test("initCiWorkflow creates enterprise workflow matrix", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-enterprise-"));
  const result = await initCiWorkflow(dir, true, {
    mode: "enterprise",
    schedule: "weekly",
    target: "github",
  });
  const content = await readFile(result.path, "utf8");

  expect(content.includes("Rainy Updates Enterprise")).toBe(true);
  expect(content.includes("matrix")).toBe(true);
  expect(content.includes("retention-days: 14")).toBe(true);
  expect(content.includes("--fail-on minor")).toBe(true);
  expect(content.includes("--max-updates 50")).toBe(true);
  expect(content.includes("--mode enterprise")).toBe(true);
  expect(content.includes("--gate review")).toBe(true);
  expect(content.includes("--gate upgrade")).toBe(true);
  expect(content.includes("--from-plan .artifacts/decision-plan.json")).toBe(true);
  expect(content.includes("--verification-report-file .artifacts/verification-node-${{ matrix.node }}.json")).toBe(true);
  expect(content.includes("Setup Node")).toBe(true);
});

test("initCiWorkflow supports Yarn Berry installs via Corepack", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-yarn-"));
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "init-ci-yarn-fixture",
        version: "1.0.0",
        packageManager: "yarn@4.6.0",
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await initCiWorkflow(dir, true, {
    mode: "minimal",
    schedule: "off",
    target: "github",
  });
  const content = await readFile(result.path, "utf8");

  expect(content.includes("Enable Corepack")).toBe(true);
  expect(content.includes("yarn install --immutable")).toBe(true);
  expect(content.includes("Setup Node")).toBe(true);
});

test("initCiWorkflow can generate local cron automation template", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-cron-"));
  const result = await initCiWorkflow(dir, true, {
    mode: "strict",
    schedule: "daily",
    target: "cron",
  });
  expect(result.path.endsWith("rainy-updates.cron")).toBe(true);
  expect(result.writtenFiles.some((file) => file.endsWith("rainy-updates-runner.sh"))).toBe(true);

  const content = await readFile(result.path, "utf8");
  expect(content.includes("crontab")).toBe(true);
  expect(content.includes("0 8 * * *")).toBe(true);
});
