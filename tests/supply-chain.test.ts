import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runSupplyChainService } from "../src/services/supply-chain.js";

test("supply-chain service scans Docker, Actions, Terraform, and Helm", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-supply-chain-"));
  await mkdir(path.join(cwd, ".github", "workflows"), { recursive: true });
  await mkdir(path.join(cwd, "infra"), { recursive: true });
  await mkdir(path.join(cwd, "charts", "app"), { recursive: true });

  await writeFile(
    path.join(cwd, "Dockerfile"),
    "FROM node:latest\n",
    "utf8",
  );
  await writeFile(
    path.join(cwd, ".github", "workflows", "ci.yml"),
    "jobs:\n  test:\n    steps:\n      - uses: actions/checkout@v4\n",
    "utf8",
  );
  await writeFile(
    path.join(cwd, "infra", "main.tf"),
    'terraform {\n  required_providers {\n    aws = {\n      source = "hashicorp/aws"\n      version = ">= 5.0.0"\n    }\n  }\n}\n',
    "utf8",
  );
  await writeFile(
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
