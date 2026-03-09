import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { BadgeOptions, BadgeResult } from "../types/index.js";
import { writeFileAtomic } from "../utils/io.js";
import { stableStringify } from "../utils/stable-json.js";

const DEFAULT_BADGE_PATH = "badges/health.json";
const DEFAULT_WORKFLOW_FILE = ".github/workflows/health-badge.yml";
const DEFAULT_SNIPPET_FILE = ".artifacts/badges/README-badge-snippet.md";

export async function runBadgeService(options: BadgeOptions): Promise<BadgeResult> {
  const resolvedBadgePath = sanitizeBadgePath(options.badgePath ?? DEFAULT_BADGE_PATH);
  const workflowPath = path.resolve(options.cwd, options.workflowFile ?? DEFAULT_WORKFLOW_FILE);
  const snippetPath = path.resolve(options.cwd, options.snippetFile ?? DEFAULT_SNIPPET_FILE);

  const detected = await detectRepositoryInfo(options.cwd);
  const owner = options.owner ?? detected.owner ?? "OWNER";
  const repo = options.repo ?? detected.repo ?? path.basename(options.cwd);
  const branch = options.branch ?? "main";

  const endpointUrl = buildBadgeEndpointUrl(owner, repo, resolvedBadgePath);
  const shieldsUrl = `https://img.shields.io/endpoint?url=${encodeURIComponent(endpointUrl)}`;
  const markdownSnippet = `![Repo Health](${shieldsUrl})`;

  const result: BadgeResult = {
    action: options.action,
    cwd: options.cwd,
    owner,
    repo,
    branch,
    badgePath: resolvedBadgePath,
    badgeEndpointUrl: endpointUrl,
    shieldsUrl,
    markdownSnippet,
    workflowPath,
    workflowCreated: false,
    snippetPath,
    snippetCreated: false,
    readmeUpdated: false,
    warnings: [],
    errors: [],
  };

  if (options.action === "init") {
    const workflowExists = await Bun.file(workflowPath).exists();
    if (!workflowExists || options.force) {
      const workflowContent = renderWorkflowTemplate(branch);
      await writeFileAtomic(workflowPath, workflowContent);
      result.workflowCreated = true;
    } else {
      result.warnings.push(`Workflow already exists: ${path.relative(options.cwd, workflowPath)}`);
    }

    await mkdir(path.dirname(snippetPath), { recursive: true });
    const snippetContent = renderReadmeSnippet(endpointUrl, markdownSnippet);
    await writeFileAtomic(snippetPath, snippetContent);
    result.snippetCreated = true;

    if (options.updateReadme) {
      const readmePath = path.resolve(options.cwd, "README.md");
      const exists = await Bun.file(readmePath).exists();
      if (!exists) {
        result.warnings.push("README.md not found; snippet file was generated instead.");
      } else {
        const current = await Bun.file(readmePath).text();
        if (current.includes(markdownSnippet) || current.includes("<!-- rainy-updates-badge -->")) {
          result.warnings.push("README already includes a Rainy badge block.");
        } else {
          const updated = appendBadgeBlock(current, markdownSnippet);
          await writeFileAtomic(readmePath, updated);
          result.readmeUpdated = true;
        }
      }
    }
  }

  if (options.format === "json" && options.jsonFile) {
    await writeFileAtomic(options.jsonFile, `${stableStringify(result, 2)}\n`);
  }

  return result;
}

export function renderBadgeResult(result: BadgeResult): string {
  if (result.format === "json") {
    return stableStringify(result, 2);
  }

  const lines = [
    `Badge action: ${result.action}`,
    `Repository: ${result.owner}/${result.repo}`,
    `Badge endpoint: ${result.badgeEndpointUrl}`,
    `Shields URL: ${result.shieldsUrl}`,
    `Markdown: ${result.markdownSnippet}`,
  ];

  if (result.action === "init") {
    lines.push(
      `Workflow: ${result.workflowCreated ? "created" : "kept"} (${result.workflowPath})`,
      `Snippet file: ${result.snippetCreated ? "created" : "kept"} (${result.snippetPath})`,
      `README updated: ${result.readmeUpdated ? "yes" : "no"}`,
    );
  }

  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push("Errors:");
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
  }

  return lines.join("\n");
}

function renderWorkflowTemplate(branch: string): string {
  return `name: Publish Repo Health Badge

on:
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch:
  push:
    branches:
      - ${branch}

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: github-pages
  cancel-in-progress: true

jobs:
  build-badge:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Generate doctor badge JSON
        run: |
          mkdir -p .public/badges .artifacts
          bunx @rainy-updates/cli doctor --workspace --badge-file .public/badges/health.json --json-file .artifacts/doctor.json
          cat > .public/index.html <<'HTML'
          <!doctype html>
          <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Rainy Updates Badge</title>
            </head>
            <body>
              <h1>Rainy Updates Badge</h1>
              <p>
                Badge JSON:
                <a href="./badges/health.json">./badges/health.json</a>
              </p>
            </body>
          </html>
          HTML
          touch .public/.nojekyll

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: .public

  deploy-badge:
    needs: build-badge
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
}

function renderReadmeSnippet(endpointUrl: string, markdownSnippet: string): string {
  return `## Dependency Health Badge

\`\`\`md
${markdownSnippet}
\`\`\`

Endpoint URL:

\`\`\`text
${endpointUrl}
\`\`\`
`;
}

function appendBadgeBlock(readme: string, markdownSnippet: string): string {
  const trimmed = readme.trimEnd();
  return `${trimmed}\n\n## Dependency Health Badge\n\n<!-- rainy-updates-badge -->\n\n${markdownSnippet}\n`;
}

function sanitizeBadgePath(value: string): string {
  return value.replace(/^\/+/, "");
}

function buildBadgeEndpointUrl(owner: string, repo: string, badgePath: string): string {
  const isUserSite = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;
  if (isUserSite) {
    return `https://${owner}.github.io/${badgePath}`;
  }
  return `https://${owner}.github.io/${repo}/${badgePath}`;
}

async function detectRepositoryInfo(
  cwd: string,
): Promise<{ owner?: string; repo?: string }> {
  const fromGit = await detectRepositoryFromGit(cwd);
  if (fromGit.owner && fromGit.repo) {
    return fromGit;
  }

  const manifestPath = path.resolve(cwd, "package.json");
  if (await Bun.file(manifestPath).exists()) {
    try {
      const manifest = (await Bun.file(manifestPath).json()) as {
        repository?: string | { url?: string };
      };
      const repositoryUrl =
        typeof manifest.repository === "string"
          ? manifest.repository
          : manifest.repository?.url;
      if (repositoryUrl) {
        return parseRepositoryFromUrl(repositoryUrl);
      }
    } catch {
      return {};
    }
  }

  return {};
}

async function detectRepositoryFromGit(
  cwd: string,
): Promise<{ owner?: string; repo?: string }> {
  try {
    const proc = Bun.spawn(["git", "config", "--get", "remote.origin.url"], {
      cwd,
      stdout: "pipe",
      stderr: "ignore",
    });
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    if (exitCode !== 0) {
      return {};
    }
    return parseRepositoryFromUrl(stdout.trim());
  } catch {
    return {};
  }
}

function parseRepositoryFromUrl(url: string): { owner?: string; repo?: string } {
  const normalized = url.trim();
  if (!normalized) {
    return {};
  }
  const match = normalized.match(/github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (!match) {
    return {};
  }
  return {
    owner: match[1],
    repo: match[2],
  };
}
