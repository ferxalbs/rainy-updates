import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  buildInstallInvocation,
  buildTestCommand,
  createPackageManagerProfile,
  detectPackageManagerDetails,
  type PackageManagerProfile,
} from "../pm/detect.js";
import { runBadgeService } from "../services/badge.js";

export type InitCiMode = "minimal" | "strict" | "enterprise";
export type InitCiSchedule = "weekly" | "daily" | "off";
export type InitCiTarget = "github" | "cron" | "systemd";

export interface InitCiOptions {
  mode: InitCiMode;
  schedule: InitCiSchedule;
  target: InitCiTarget;
  withBadge?: boolean;
}

export async function initCiWorkflow(
  cwd: string,
  force: boolean,
  options: InitCiOptions,
): Promise<{ path: string; created: boolean; writtenFiles: string[] }> {
  const detected = await detectPackageManagerDetails(cwd);
  const packageManager = createPackageManagerProfile("auto", detected);

  const primary = options.target === "github"
    ? await initGitHubWorkflow(cwd, force, options, packageManager)
    : await initLocalAutomation(cwd, force, options);

  if (!options.withBadge) {
    return primary;
  }

  const badge = await runBadgeService({
    cwd,
    action: "init",
    owner: undefined,
    repo: undefined,
    branch: "main",
    badgePath: "badges/health.json",
    workflowFile: ".github/workflows/health-badge.yml",
    snippetFile: ".artifacts/badges/README-badge-snippet.md",
    updateReadme: false,
    force,
    format: "json",
    jsonFile: undefined,
  });

  const writtenFiles = [...primary.writtenFiles];
  if (badge.workflowCreated) {
    writtenFiles.push(badge.workflowPath);
  }
  if (badge.snippetCreated) {
    writtenFiles.push(badge.snippetPath);
  }

  return {
    path: primary.path,
    created: primary.created || badge.workflowCreated || badge.snippetCreated,
    writtenFiles,
  };
}

async function initGitHubWorkflow(
  cwd: string,
  force: boolean,
  options: InitCiOptions,
  packageManager: PackageManagerProfile,
): Promise<{ path: string; created: boolean; writtenFiles: string[] }> {
  const workflowPath = path.join(cwd, ".github", "workflows", "rainy-updates.yml");

  if (!force && (await Bun.file(workflowPath).exists())) {
    return { path: workflowPath, created: false, writtenFiles: [] };
  }

  const scheduleBlock = renderScheduleBlock(options.schedule);
  const workflow =
    options.mode === "minimal"
      ? minimalWorkflowTemplate(scheduleBlock, packageManager)
      : options.mode === "strict"
        ? strictWorkflowTemplate(scheduleBlock, packageManager)
        : enterpriseWorkflowTemplate(scheduleBlock, packageManager);

  await mkdir(path.dirname(workflowPath), { recursive: true });
  await Bun.write(workflowPath, workflow);

  return { path: workflowPath, created: true, writtenFiles: [workflowPath] };
}

async function initLocalAutomation(
  cwd: string,
  force: boolean,
  options: InitCiOptions,
): Promise<{ path: string; created: boolean; writtenFiles: string[] }> {
  const outDir = path.join(cwd, ".artifacts", "automation");
  const runnerPath = path.join(outDir, "rainy-updates-runner.sh");
  const cronPath = path.join(outDir, "rainy-updates.cron");
  const servicePath = path.join(outDir, "rainy-updates.service");
  const timerPath = path.join(outDir, "rainy-updates.timer");

  const primaryPath = options.target === "cron" ? cronPath : timerPath;
  if (!force && (await Bun.file(primaryPath).exists())) {
    return { path: primaryPath, created: false, writtenFiles: [] };
  }

  await mkdir(outDir, { recursive: true });
  const writtenFiles: string[] = [];

  await Bun.write(runnerPath, localRunnerScript(cwd, options.mode));
  writtenFiles.push(runnerPath);

  if (options.target === "cron") {
    await Bun.write(cronPath, renderLocalCron(options.schedule, cwd, runnerPath));
    writtenFiles.push(cronPath);
    return { path: cronPath, created: true, writtenFiles };
  }

  await Bun.write(servicePath, renderSystemdService(cwd, runnerPath));
  await Bun.write(timerPath, renderSystemdTimer(options.schedule));
  writtenFiles.push(servicePath, timerPath);

  return { path: timerPath, created: true, writtenFiles };
}

function renderScheduleBlock(schedule: InitCiSchedule): string {
  if (schedule === "off") {
    return "  workflow_dispatch:";
  }

  const cron = schedule === "daily" ? "0 8 * * *" : "0 8 * * 1";
  return `  schedule:\n    - cron: '${cron}'\n  workflow_dispatch:`;
}

function localRunnerScript(cwd: string, mode: InitCiMode): string {
  return `#!/usr/bin/env bash
set -euo pipefail

cd ${quoteSh(cwd)}
mkdir -p .artifacts
bunx --bun @rainy-updates/cli ci \\
  --workspace \\
  --mode ${mode} \\
  --gate review \\
  --plan-file .artifacts/decision-plan.json \\
  --stream \\
  --format json \\
  --json-file .artifacts/deps-report.json
`;
}

function renderLocalCron(
  schedule: InitCiSchedule,
  cwd: string,
  runnerPath: string,
): string {
  const logPath = path.join(cwd, ".artifacts", "automation", "rainy-updates.log");
  const runner = quoteSh(runnerPath);
  const runLine = schedule === "off"
    ? `# Disabled schedule. Run manually with: bash ${runner}`
    : `${schedule === "daily" ? "0 8 * * *" : "0 8 * * 1"} cd ${quoteSh(cwd)} && bash ${runner} >> ${quoteSh(logPath)} 2>&1`;

  return `# Rainy Updates local cron (${schedule})
# Install with: crontab .artifacts/automation/rainy-updates.cron
${runLine}
`;
}

function renderSystemdService(cwd: string, runnerPath: string): string {
  return `[Unit]
Description=Rainy Updates local dependency CI run

[Service]
Type=oneshot
WorkingDirectory=${cwd}
ExecStart=/bin/bash ${runnerPath}
`;
}

function renderSystemdTimer(schedule: InitCiSchedule): string {
  const onCalendar =
    schedule === "off"
      ? ""
      : schedule === "daily"
        ? "OnCalendar=*-*-* 08:00:00"
        : "OnCalendar=Mon *-*-* 08:00:00";

  return `[Unit]
Description=Schedule Rainy Updates local dependency CI run

[Timer]
${onCalendar || "# Disabled schedule; set OnCalendar manually"}
Persistent=true

[Install]
WantedBy=timers.target
`;
}

function quoteSh(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function installStep(profile: PackageManagerProfile): string {
  const install = buildInstallInvocation(profile, { frozen: true, ci: true });
  return `      - name: Install dependencies\n        run: ${install.display}`;
}

function runtimeSetupSteps(profile: PackageManagerProfile): string {
  const lines = [
    `      - name: Checkout\n        uses: actions/checkout@v4`,
  ];

  if (profile.manager !== "bun") {
    lines.push(
      `      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: 22`,
    );
  }

  lines.push(
    `      - name: Setup Bun\n        uses: oven-sh/setup-bun@v1`,
  );

  if (profile.manager === "pnpm" || profile.manager === "yarn") {
    lines.push(
      `      - name: Enable Corepack\n        run: corepack enable`,
    );
  }

  if (profile.manager === "pnpm") {
    lines.push(
      `      - name: Prepare pnpm\n        run: corepack prepare pnpm@9 --activate`,
    );
  }

  return lines.join("\n\n");
}

function minimalWorkflowTemplate(
  scheduleBlock: string,
  profile: PackageManagerProfile,
): string {
  return `name: Rainy Updates\n\non:\n${scheduleBlock}\n\njobs:\n  dependency-check:\n    runs-on: ubuntu-latest\n    steps:\n${runtimeSetupSteps(profile)}\n\n${installStep(profile)}\n\n      - name: Run dependency check\n        run: |\n          bunx --bun @rainy-updates/cli ci \\\n            --workspace \\\n            --mode minimal \\\n            --gate check \\\n            --ci \\\n            --stream \\\n            --registry-timeout-ms 12000 \\\n            --registry-retries 4 \\\n            --format table\n`;
}

function strictWorkflowTemplate(
  scheduleBlock: string,
  profile: PackageManagerProfile,
): string {
  return `name: Rainy Updates\n\non:\n${scheduleBlock}\n\npermissions:\n  contents: read\n  security-events: write\n\njobs:\n  dependency-check:\n    runs-on: ubuntu-latest\n    steps:\n${runtimeSetupSteps(profile)}\n\n${installStep(profile)}\n\n      - name: Warm cache\n        run: bunx --bun @rainy-updates/cli warm-cache --workspace --concurrency 32 --registry-timeout-ms 12000 --registry-retries 4\n\n      - name: Generate reviewed decision plan\n        run: |\n          bunx --bun @rainy-updates/cli ci \\\n            --workspace \\\n            --mode strict \\\n            --gate review \\\n            --plan-file .artifacts/decision-plan.json \\\n            --ci \\\n            --concurrency 32 \\\n            --stream \\\n            --registry-timeout-ms 12000 \\\n            --registry-retries 4 \\\n            --format github \\\n            --json-file .artifacts/deps-report.json \\\n            --pr-report-file .artifacts/deps-report.md \\\n            --sarif-file .artifacts/deps-report.sarif \\\n            --github-output $GITHUB_OUTPUT\n\n      - name: Upload report artifacts\n        uses: actions/upload-artifact@v4\n        with:\n          name: rainy-updates-report\n          path: .artifacts/\n\n      - name: Upload SARIF\n        uses: github/codeql-action/upload-sarif@v3\n        with:\n          sarif_file: .artifacts/deps-report.sarif\n`;
}

function enterpriseWorkflowTemplate(
  scheduleBlock: string,
  profile: PackageManagerProfile,
): string {
  const install = buildInstallInvocation(profile, { frozen: true, ci: true });
  const testCmd = buildTestCommand(profile);

  return `name: Rainy Updates Enterprise\n\non:\n${scheduleBlock}\n\npermissions:\n  contents: read\n  security-events: write\n  actions: read\n\nconcurrency:\n  group: rainy-updates-\${{ github.ref }}\n  cancel-in-progress: false\n\njobs:\n  dependency-check:\n    runs-on: ubuntu-latest\n    strategy:\n      fail-fast: false\n      matrix:\n        node: [20, 22]\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: \${{ matrix.node }}\n\n      - name: Setup Bun\n        uses: oven-sh/setup-bun@v1\n\n${profile.manager === "pnpm" || profile.manager === "yarn" ? '      - name: Enable Corepack\n        run: corepack enable\n\n' : ""}${profile.manager === "pnpm" ? '      - name: Prepare pnpm\n        run: corepack prepare pnpm@9 --activate\n\n' : ""}      - name: Install dependencies\n        run: ${install.display}\n\n      - name: Warm cache\n        run: bunx --bun @rainy-updates/cli warm-cache --workspace --concurrency 32 --registry-timeout-ms 12000 --registry-retries 4\n\n      - name: Generate reviewed decision plan\n        run: |\n          bunx --bun @rainy-updates/cli ci \\\n            --workspace \\\n            --mode enterprise \\\n            --gate review \\\n            --plan-file .artifacts/decision-plan.json \\\n            --concurrency 32 \\\n            --stream \\\n            --registry-timeout-ms 12000 \\\n            --registry-retries 4 \\\n            --lockfile-mode preserve \\\n            --format github \\\n            --fail-on minor \\\n            --max-updates 50 \\\n            --json-file .artifacts/deps-report-node-\${{ matrix.node }}.json \\\n            --pr-report-file .artifacts/deps-report-node-\${{ matrix.node }}.md \\\n            --sarif-file .artifacts/deps-report-node-\${{ matrix.node }}.sarif \\\n            --github-output $GITHUB_OUTPUT\n\n      - name: Replay approved plan with verification\n        run: |\n          bunx --bun @rainy-updates/cli ci \\\n            --workspace \\\n            --mode enterprise \\\n            --gate upgrade \\\n            --from-plan .artifacts/decision-plan.json \\\n            --verify test \\\n            --test-command "${testCmd}" \\\n            --verification-report-file .artifacts/verification-node-\${{ matrix.node }}.json\n\n      - name: Upload report artifacts\n        uses: actions/upload-artifact@v4\n        with:\n          name: rainy-updates-report-node-\${{ matrix.node }}\n          path: .artifacts/\n          retention-days: 14\n\n      - name: Upload SARIF\n        uses: github/codeql-action/upload-sarif@v3\n        with:\n          sarif_file: .artifacts/deps-report-node-\${{ matrix.node }}.sarif\n`;
}
