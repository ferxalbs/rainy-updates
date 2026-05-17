import { expect, test } from "bun:test";
import { $ } from "bun";
// readFile, writeFile was here;
import os from "node:os";
import { $ } from "bun";
import path from "node:path";
import { initCiWorkflow } from "../src/core/init-ci.js";

test("initCiWorkflow creates strict workflow file", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-init-ci-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  const result = await initCiWorkflow(dir, false, {
    mode: "strict",
    schedule: "weekly",
    target: "github",
  });
  expect(result.created).toBe(true);

  const content = await Bun.file(result.path).text();
  expect(content.includes("Rainy Updates")).toBe(true);
  expect(content.includes("Warm cache")).toBe(true);
  expect(content.includes("Upload SARIF")).toBe(true);
  expect(content.includes("@rainy-updates/cli ci")).toBe(true);
  expect(content.includes("bunx --bun @rainy-updates/cli")).toBe(true);
  expect(content.includes("--mode strict")).toBe(true);
  expect(content.includes("--gate review")).toBe(true);
  expect(content.includes("--plan-file .artifacts/decision-plan.json")).toBe(true);
  expect(content.includes("Setup Bun")).toBe(true);
});

test("initCiWorkflow uses pnpm install when pnpm lockfile exists", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-init-ci-pnpm-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

  const result = await initCiWorkflow(dir, true, {
    mode: "minimal",
    schedule: "off",
    target: "github",
  });
  const content = await Bun.file(result.path).text();
  expect(content.includes("pnpm install --frozen-lockfile")).toBe(true);
  expect(content.includes("workflow_dispatch")).toBe(true);
});

test("initCiWorkflow creates enterprise workflow matrix", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-init-ci-enterprise-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  const result = await initCiWorkflow(dir, true, {
    mode: "enterprise",
    schedule: "weekly",
    target: "github",
  });
  const content = await Bun.file(result.path).text();

  expect(content.includes("Rainy Updates Enterprise")).toBe(true);
  expect(content.includes("retention-days: 14")).toBe(true);
  expect(content.includes("--fail-on minor")).toBe(true);
  expect(content.includes("--max-updates 50")).toBe(true);
  expect(content.includes("--mode enterprise")).toBe(true);
  expect(content.includes("--gate review")).toBe(true);
  expect(content.includes("--gate upgrade")).toBe(true);
  expect(content.includes("--from-plan .artifacts/decision-plan.json")).toBe(true);
  expect(content.includes("--verification-report-file .artifacts/verification.json")).toBe(true);
  expect(content.includes("Setup Bun")).toBe(true);
});

test("initCiWorkflow supports Yarn Berry installs via Corepack", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-init-ci-yarn-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
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
  const content = await Bun.file(result.path).text();

  expect(content.includes("Enable Corepack")).toBe(true);
  expect(content.includes("yarn install --immutable")).toBe(true);
  expect(content.includes("Setup Bun")).toBe(true);
});

test("initCiWorkflow can generate local cron automation template", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-init-ci-cron-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  const result = await initCiWorkflow(dir, true, {
    mode: "strict",
    schedule: "daily",
    target: "cron",
  });
  expect(result.path.endsWith("rainy-updates.cron")).toBe(true);
  expect(result.writtenFiles.some((file) => file.endsWith("rainy-updates-runner.sh"))).toBe(true);

  const content = await Bun.file(result.path).text();
  expect(content.includes("crontab")).toBe(true);
  expect(content.includes("0 8 * * *")).toBe(true);
});

test("initCiWorkflow can bootstrap badge assets when withBadge is enabled", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-init-ci-badge-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  const result = await initCiWorkflow(dir, true, {
    mode: "minimal",
    schedule: "off",
    target: "github",
    withBadge: true,
  });

  expect(result.writtenFiles.some((file) => file.endsWith("health-badge.yml"))).toBe(true);
  expect(result.writtenFiles.some((file) => file.endsWith("README-badge-snippet.md"))).toBe(true);
});
