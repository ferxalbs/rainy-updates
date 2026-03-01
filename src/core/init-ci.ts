import { access, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type InitCiMode = "minimal" | "strict" | "enterprise";
export type InitCiSchedule = "weekly" | "daily" | "off";

export interface InitCiOptions {
  mode: InitCiMode;
  schedule: InitCiSchedule;
}

export async function initCiWorkflow(
  cwd: string,
  force: boolean,
  options: InitCiOptions,
): Promise<{ path: string; created: boolean }> {
  const workflowPath = path.join(
    cwd,
    ".github",
    "workflows",
    "rainy-updates.yml",
  );

  try {
    if (!force) {
      await access(workflowPath);
      return { path: workflowPath, created: false };
    }
  } catch {
    // missing file, continue create
  }

  const packageManager = await detectPackageManager(cwd);
  const scheduleBlock = renderScheduleBlock(options.schedule);
  const workflow =
    options.mode === "minimal"
      ? minimalWorkflowTemplate(scheduleBlock, packageManager)
      : options.mode === "strict"
        ? strictWorkflowTemplate(scheduleBlock, packageManager)
        : enterpriseWorkflowTemplate(scheduleBlock, packageManager);

  await mkdir(path.dirname(workflowPath), { recursive: true });
  await writeFile(workflowPath, workflow, "utf8");

  return { path: workflowPath, created: true };
}

async function detectPackageManager(
  cwd: string,
): Promise<"npm" | "pnpm" | "bun"> {
  try {
    await access(path.join(cwd, "bun.lockb"));
    return "bun";
  } catch {}
  try {
    await access(path.join(cwd, "bun.lock"));
    return "bun";
  } catch {}

  const pnpmLock = path.join(cwd, "pnpm-lock.yaml");
  try {
    await access(pnpmLock);
    return "pnpm";
  } catch {
    return "npm";
  }
}

function renderScheduleBlock(schedule: InitCiSchedule): string {
  if (schedule === "off") {
    return "  workflow_dispatch:";
  }

  const cron = schedule === "daily" ? "0 8 * * *" : "0 8 * * 1";
  return `  schedule:\n    - cron: '${cron}'\n  workflow_dispatch:`;
}

function installStep(packageManager: "npm" | "pnpm" | "bun"): string {
  if (packageManager === "bun") {
    return `      - name: Install dependencies\n        run: bun install`;
  }
  if (packageManager === "pnpm") {
    return `      - name: Setup pnpm\n        uses: pnpm/action-setup@v4\n        with:\n          version: 9\n\n      - name: Install dependencies\n        run: pnpm install --frozen-lockfile`;
  }

  return `      - name: Install dependencies\n        run: npm ci`;
}

function minimalWorkflowTemplate(
  scheduleBlock: string,
  packageManager: "npm" | "pnpm" | "bun",
): string {
  return `name: Rainy Updates\n\non:\n${scheduleBlock}\n\njobs:\n  dependency-check:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n\n      - name: Setup Bun\n        uses: oven-sh/setup-bun@v1\n\n${installStep(packageManager)}\n\n      - name: Run dependency check\n        run: |\n          bunx @rainy-updates/cli ci \\\n            --workspace \\\n            --mode minimal \\\n            --gate check \\\n            --ci \\\n            --stream \\\n            --registry-timeout-ms 12000 \\\n            --registry-retries 4 \\\n            --format table\n`;
}

function strictWorkflowTemplate(
  scheduleBlock: string,
  packageManager: "npm" | "pnpm" | "bun",
): string {
  return `name: Rainy Updates\n\non:\n${scheduleBlock}\n\npermissions:\n  contents: read\n  security-events: write\n\njobs:\n  dependency-check:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n\n      - name: Setup Bun\n        uses: oven-sh/setup-bun@v1\n\n${installStep(packageManager)}\n\n      - name: Warm cache\n        run: bunx @rainy-updates/cli warm-cache --workspace --concurrency 32 --registry-timeout-ms 12000 --registry-retries 4\n\n      - name: Generate reviewed decision plan\n        run: |\n          bunx @rainy-updates/cli ci \\\n            --workspace \\\n            --mode strict \\\n            --gate review \\\n            --plan-file .artifacts/decision-plan.json \\\n            --ci \\\n            --concurrency 32 \\\n            --stream \\\n            --registry-timeout-ms 12000 \\\n            --registry-retries 4 \\\n            --format github \\\n            --json-file .artifacts/deps-report.json \\\n            --pr-report-file .artifacts/deps-report.md \\\n            --sarif-file .artifacts/deps-report.sarif \\\n            --github-output $GITHUB_OUTPUT\n\n      - name: Upload report artifacts\n        uses: actions/upload-artifact@v4\n        with:\n          name: rainy-updates-report\n          path: .artifacts/\n\n      - name: Upload SARIF\n        uses: github/codeql-action/upload-sarif@v3\n        with:\n          sarif_file: .artifacts/deps-report.sarif\n`;
}

function enterpriseWorkflowTemplate(
  scheduleBlock: string,
  packageManager: "npm" | "pnpm" | "bun",
): string {
  let detectedPmInstall = "npm ci";
  let testCmd = "npm test";
  if (packageManager === "pnpm") {
    detectedPmInstall =
      "corepack enable && corepack prepare pnpm@9 --activate && pnpm install --frozen-lockfile";
    testCmd = "pnpm test";
  } else if (packageManager === "bun") {
    detectedPmInstall = "bun install";
    testCmd = "bun test";
  }

  return `name: Rainy Updates Enterprise\n\non:\n${scheduleBlock}\n\npermissions:\n  contents: read\n  security-events: write\n  actions: read\n\nconcurrency:\n  group: rainy-updates-\${{ github.ref }}\n  cancel-in-progress: false\n\njobs:\n  dependency-check:\n    runs-on: ubuntu-latest\n    strategy:\n      fail-fast: false\n      matrix:\n        node: [20, 22]\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: \${{ matrix.node }}\n\n      - name: Setup Bun\n        uses: oven-sh/setup-bun@v1\n\n      - name: Install dependencies\n        run: ${detectedPmInstall}\n\n      - name: Warm cache\n        run: bunx @rainy-updates/cli warm-cache --workspace --concurrency 32 --registry-timeout-ms 12000 --registry-retries 4\n\n      - name: Generate reviewed decision plan\n        run: |\n          bunx @rainy-updates/cli ci \\\n            --workspace \\\n            --mode enterprise \\\n            --gate review \\\n            --plan-file .artifacts/decision-plan.json \\\n            --concurrency 32 \\\n            --stream \\\n            --registry-timeout-ms 12000 \\\n            --registry-retries 4 \\\n            --lockfile-mode preserve \\\n            --format github \\\n            --fail-on minor \\\n            --max-updates 50 \\\n            --json-file .artifacts/deps-report-node-\${{ matrix.node }}.json \\\n            --pr-report-file .artifacts/deps-report-node-\${{ matrix.node }}.md \\\n            --sarif-file .artifacts/deps-report-node-\${{ matrix.node }}.sarif \\\n            --github-output $GITHUB_OUTPUT\n\n      - name: Replay approved plan with verification\n        run: |\n          bunx @rainy-updates/cli ci \\\n            --workspace \\\n            --mode enterprise \\\n            --gate upgrade \\\n            --from-plan .artifacts/decision-plan.json \\\n            --verify test \\\n            --test-command "${testCmd}" \\\n            --verification-report-file .artifacts/verification-node-\${{ matrix.node }}.json\n\n      - name: Upload report artifacts\n        uses: actions/upload-artifact@v4\n        with:\n          name: rainy-updates-report-node-\${{ matrix.node }}\n          path: .artifacts/\n          retention-days: 14\n\n      - name: Upload SARIF\n        uses: github/codeql-action/upload-sarif@v3\n        with:\n          sarif_file: .artifacts/deps-report-node-\${{ matrix.node }}.sarif\n`;
}
