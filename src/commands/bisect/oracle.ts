import path from "node:path";
import type { BisectOptions, BisectOutcome } from "../../types/index.js";
import { detectPackageManager, resolvePackageManager } from "../../pm/detect.js";

/**
 * The "oracle" for bisect: installs a specific version of a package
 * into the project's node_modules (via the shell), then runs --cmd.
 * Returns "good" (exit 0), "bad" (non-zero exit), or "skip" on install error.
 */
export async function bisectOracle(
  packageName: string,
  version: string,
  options: BisectOptions,
): Promise<BisectOutcome> {
  if (options.dryRun) {
    // In dry-run mode, simulate the oracle without side effects
    process.stderr.write(
      `[bisect:dry-run] Would test ${packageName}@${version}\n`,
    );
    return "skip";
  }

  const detected = await detectPackageManager(options.cwd);
  const packageManager = resolvePackageManager("auto", detected, "bun");
  const installResult = await runShell(
    buildInstallCommand(packageManager, packageName, version),
    options.cwd,
  );

  if (installResult !== 0) {
    process.stderr.write(
      `[bisect] Failed to install ${packageName}@${version}, skipping.\n`,
    );
    return "skip";
  }

  process.stderr.write(`[bisect] Testing ${packageName}@${version}...\n`);
  const testResult = await runShell(options.testCommand, options.cwd);
  const outcome: BisectOutcome = testResult === 0 ? "good" : "bad";
  process.stderr.write(`[bisect] ${packageName}@${version} → ${outcome}\n`);
  return outcome;
}

async function runShell(command: string, cwd: string): Promise<number> {
  try {
    const shellCmd = process.env.SHELL || "sh";
    const proc = Bun.spawn([shellCmd, "-c", command], {
      cwd: path.resolve(cwd),
      stdout: "pipe",
      stderr: "pipe",
    });
    return await proc.exited;
  } catch {
    return 1;
  }
}

function buildInstallCommand(
  packageManager: "bun" | "npm" | "pnpm" | "yarn",
  packageName: string,
  version: string,
): string {
  const spec = `${packageName}@${version}`;
  switch (packageManager) {
    case "bun":
      return `bun add --exact --no-save ${spec}`;
    case "pnpm":
      return `pnpm add --save-exact --no-save ${spec}`;
    case "yarn":
      return `npm install --no-save --save-exact ${spec}`;
    default:
      return `npm install --no-save --save-exact ${spec}`;
  }
}
