import type {
  UpgradeOptions,
  VerificationCheck,
  VerificationMode,
  VerificationResult,
} from "../types/index.js";
import {
  buildInstallInvocation,
  buildTestCommand,
  createPackageManagerProfile,
  detectPackageManagerDetails,
} from "../pm/detect.js";
import { installDependencies } from "../pm/install.js";
import { stableStringify } from "../utils/stable-json.js";
import { writeFileAtomic } from "../utils/io.js";
import { buildShellInvocation } from "../utils/shell.js";

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
  const detected = await detectPackageManagerDetails(options.cwd);
  const profile = createPackageManagerProfile(options.packageManager, detected, "bun");

  if (includesInstall(mode)) {
    const installInvocation = buildInstallInvocation(profile);
    checks.push(
      await runCheck(
        "install",
        installInvocation.display,
        async () => {
          await installDependencies(options.cwd, options.packageManager, detected);
        },
      ),
    );
  }

  if (includesTest(mode)) {
    const command =
      options.testCommand ??
      defaultTestCommand(profile);
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

function defaultTestCommand(profile: ReturnType<typeof createPackageManagerProfile>): string {
  return buildTestCommand(profile);
}

async function runShellCheck(
  cwd: string,
  command: string,
): Promise<VerificationCheck> {
  const startedAt = Date.now();

  try {
    const invocation = buildShellInvocation(command);
    const proc = Bun.spawn([invocation.shell, ...invocation.args], {
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
