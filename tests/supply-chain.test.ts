import { expect, test } from "bun:test";
import { $ } from "bun";
// mkdir, writeFile was here;
import os from "os";
import { $ } from "bun";
import path from "path";
import { runSupplyChainService } from "../src/services/supply-chain.js";

test("supply-chain service scans Docker, Actions, Terraform, and Helm", async () => {
  const cwd = await (async () => { const d = path.join(os.tmpdir(), "rainy-supply-chain-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await $`mkdir -p ${path.join(cwd, ".github", "workflows")}`;
  await $`mkdir -p ${path.join(cwd, "infra")}`;
  await $`mkdir -p ${path.join(cwd, "charts", "app")}`;

  await (async (p, c) => await Bun.write(p, c))(
    path.join(cwd, "Dockerfile"),
    "FROM node:latest\n",
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(
    path.join(cwd, ".github", "workflows", "ci.yml"),
    "jobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(
    path.join(cwd, "infra", "main.tf"),
    'terraform {\n  required_providers {\n    aws = {\n      source = "hashicorp/aws"\n      version = ">= 5.0.0"\n    }\n  }\n}\n',
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(
    path.join(cwd, "charts", "app", "Chart.yaml"),
    "apiVersion: v2\nname: app\ndependencies:\n  - name: redis\n    repository: https://charts.bitnami.com/bitnami\n    version: 18.2.1\n",
    "utf8",
  );

  const result = await runSupplyChainService({
    cwd,
    workspace: false,
    scopes: ["docker", "actions", "terraform", "helm"],
    format: "json",
    jsonFile: undefined,
  });

  expect(result.errors).toHaveLength(0);
  expect(result.summary.totalFindings).toBeGreaterThanOrEqual(4);
  expect(result.findings.some((item) => item.targetType === "docker-image")).toBe(true);
  expect(result.findings.some((item) => item.targetType === "github-action")).toBe(true);
  expect(result.findings.some((item) => item.targetType === "terraform-provider")).toBe(true);
  expect(result.findings.some((item) => item.targetType === "helm-dependency")).toBe(true);
});
