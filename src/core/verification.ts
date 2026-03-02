import process from "node:process";
import type {
  UpgradeOptions,
  VerificationCheck,
  VerificationMode,
  VerificationResult,
} from "../types/index.js";
import { detectPackageManager, resolvePackageManager } from "../pm/detect.js";
import { installDependencies } from "../pm/install.js";
import { stableStringify } from "../utils/stable-json.js";
import { writeFileAtomic } from "../utils/io.js";

export async function runVerification(
  options: Pick<
    UpgradeOptions,
    | "cwd"
    | "verify"
    | "testCommand"
    | "verificationReportFile"
    | "packageManager"
  >,
): Promise<VerificationResult> {
  const mode = options.verify;
  if (mode === "none") {
    const result: VerificationResult = {
      mode,
      passed: true,
      checks: [],
    };
    await maybeWriteVerificationReport(options.verificationReportFile, result);
    return result;
  }

  const checks: VerificationCheck[] = [];
  const detected = await detectPackageManager(options.cwd);

  if (includesInstall(mode)) {
    checks.push(
      await runCheck(
        "install",
        `${resolvePackageManager(options.packageManager, detected)} install`,
        async () => {
          await installDependencies(options.cwd, options.packageManager, detected);
        },
      ),
    );
  }

  if (includesTest(mode)) {
    const command =
      options.testCommand ??
      defaultTestCommand(options.packageManager, detected);
    checks.push(await runShellCheck(options.cwd, command));
  }

  const result: VerificationResult = {
    mode,
    passed: checks.every((check) => check.passed),
    checks,
  };
  await maybeWriteVerificationReport(options.verificationReportFile, result);
  return result;
}

function includesInstall(mode: VerificationMode): boolean {
  return mode === "install" || mode === "install,test";
}

function includesTest(mode: VerificationMode): boolean {
  return mode === "test" || mode === "install,test";
}

function defaultTestCommand(
  packageManager: UpgradeOptions["packageManager"],
  detected: Awaited<ReturnType<typeof detectPackageManager>>,
): string {
  return `${resolvePackageManager(packageManager, detected, "bun")} test`;
}

async function runShellCheck(
  cwd: string,
  command: string,
): Promise<VerificationCheck> {
  const startedAt = Date.now();

  try {
    const shell = process.env.SHELL || "sh";
    const proc = Bun.spawn([shell, "-lc", command], {
      cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await proc.exited;
    return {
      name: "test",
      command,
      passed: exitCode === 0,
      exitCode,
      durationMs: Math.max(0, Date.now() - startedAt),
      error:
        exitCode === 0
          ? undefined
          : `${command} failed with exit code ${exitCode}`,
    };
  } catch (error) {
    return {
      name: "test",
      command,
      passed: false,
      exitCode: 1,
      durationMs: Math.max(0, Date.now() - startedAt),
      error: String(error),
    };
  }
}

async function runCheck(
  name: VerificationCheck["name"],
  command: string,
  action: () => Promise<void>,
): Promise<VerificationCheck> {
  const startedAt = Date.now();
  try {
    await action();
    return {
      name,
      command,
      passed: true,
      exitCode: 0,
      durationMs: Math.max(0, Date.now() - startedAt),
    };
  } catch (error) {
    return {
      name,
      command,
      passed: false,
      exitCode: 1,
      durationMs: Math.max(0, Date.now() - startedAt),
      error: String(error),
    };
  }
}

async function maybeWriteVerificationReport(
  filePath: string | undefined,
  result: VerificationResult,
): Promise<void> {
  if (!filePath) return;
  await writeFileAtomic(filePath, stableStringify(result, 2) + "\n");
}
