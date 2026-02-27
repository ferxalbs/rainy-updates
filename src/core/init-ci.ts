import { promises as fs } from "node:fs";
import path from "node:path";

export async function initCiWorkflow(cwd: string, force: boolean): Promise<{ path: string; created: boolean }> {
  const workflowPath = path.join(cwd, ".github", "workflows", "rainy-updates.yml");

  try {
    if (!force) {
      await fs.access(workflowPath);
      return { path: workflowPath, created: false };
    }
  } catch {
    // missing file, continue create
  }

  await fs.mkdir(path.dirname(workflowPath), { recursive: true });
  await fs.writeFile(workflowPath, workflowTemplate(), "utf8");

  return { path: workflowPath, created: true };
}

function workflowTemplate(): string {
  return `name: Rainy Updates\n\non:\n  schedule:\n    - cron: '0 8 * * 1'\n  workflow_dispatch:\n\njobs:\n  dependency-updates:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n\n      - name: Run rainy updates\n        run: |\n          npx @rainy-updates/cli check \\\n            --workspace \\\n            --ci \\\n            --concurrency 32 \\\n            --format github \\\n            --json-file .artifacts/deps-report.json \\\n            --sarif-file .artifacts/deps-report.sarif \\\n            --github-output $GITHUB_OUTPUT\n\n      - name: Upload SARIF\n        uses: github/codeql-action/upload-sarif@v3\n        with:\n          sarif_file: .artifacts/deps-report.sarif\n`;
}
