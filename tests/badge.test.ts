import { expect, test } from "bun:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseBadgeArgs } from "../src/commands/badge/parser.js";
import { runBadgeService } from "../src/services/badge.js";

test("parseBadgeArgs supports init options", () => {
  const parsed = parseBadgeArgs([
    "init",
    "--owner",
    "ferxalbs",
    "--repo",
    "rainy-updates",
    "--branch",
    "main",
    "--readme",
    "--format",
    "json",
  ]);

  expect(parsed.action).toBe("init");
  expect(parsed.owner).toBe("ferxalbs");
  expect(parsed.repo).toBe("rainy-updates");
  expect(parsed.branch).toBe("main");
  expect(parsed.updateReadme).toBe(true);
  expect(parsed.format).toBe("json");
});

test("runBadgeService builds endpoint and snippet", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-badge-url-"));
  const result = await runBadgeService({
    cwd,
    action: "url",
    owner: "ferxalbs",
    repo: "rainy-updates",
    branch: "main",
    badgePath: "badges/health.json",
    workflowFile: ".github/workflows/health-badge.yml",
    snippetFile: ".artifacts/badges/README-badge-snippet.md",
    updateReadme: false,
    force: false,
    format: "text",
    jsonFile: undefined,
  });

  expect(result.badgeEndpointUrl).toBe("https://ferxalbs.github.io/rainy-updates/badges/health.json");
  expect(result.shieldsUrl).toContain("https://img.shields.io/endpoint?url=");
  expect(result.markdownSnippet).toContain("![Repo Health]");
});

test("runBadgeService init writes workflow and snippet and updates README", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-badge-init-"));
  await mkdir(path.join(cwd, ".github", "workflows"), { recursive: true });
  await Bun.write(path.join(cwd, "README.md"), "# Demo\n");

  const result = await runBadgeService({
    cwd,
    action: "init",
    owner: "acme",
    repo: "tooling",
    branch: "main",
    badgePath: "badges/health.json",
    workflowFile: ".github/workflows/health-badge.yml",
    snippetFile: ".artifacts/badges/README-badge-snippet.md",
    updateReadme: true,
    force: false,
    format: "text",
    jsonFile: undefined,
  });

  expect(result.workflowCreated).toBe(true);
  expect(result.snippetCreated).toBe(true);
  expect(result.readmeUpdated).toBe(true);

  const workflow = await Bun.file(path.join(cwd, ".github/workflows/health-badge.yml")).text();
  expect(workflow).toContain("name: Publish Repo Health Badge");

  const snippet = await Bun.file(path.join(cwd, ".artifacts/badges/README-badge-snippet.md")).text();
  expect(snippet).toContain("## Dependency Health Badge");

  const readme = await Bun.file(path.join(cwd, "README.md")).text();
  expect(readme).toContain("<!-- rainy-updates-badge -->");
});
