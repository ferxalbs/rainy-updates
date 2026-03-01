import { spawn } from "node:child_process";
import type {
  UpgradeOptions,
  VerificationCheck,
  VerificationMode,
  VerificationResult,
} from "../types/index.js";
import { detectPackageManager } from "../pm/detect.js";
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
      await runCheck("install", `${resolvedPackageManager(options.packageManager, detected)} install`, async () => {
        await installDependencies(options.cwd, options.packageManager, detected);
      }),
    );
  }

  if (includesTest(mode)) {
    const command = options.testCommand ?? defaultTestCommand(options.packageManager, detected);
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
  detected: "npm" | "pnpm" | "unknown",
): string {
  const selected = resolvedPackageManager(packageManager, detected);
  return `${selected} test`;
}

function resolvedPackageManager(
  packageManager: UpgradeOptions["packageManager"],
  detected: "npm" | "pnpm" | "unknown",
): "npm" | "pnpm" {
  if (packageManager === "pnpm") return "pnpm";
  if (packageManager === "npm") return "npm";
  return detected === "pnpm" ? "pnpm" : "npm";
}

async function runShellCheck(cwd: string, command: string): Promise<VerificationCheck> {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      resolve({
        name: "test",
        command,
        passed: code === 0,
        exitCode: code ?? 1,
        durationMs: Math.max(0, Date.now() - startedAt),
        error: code === 0 ? undefined : `${command} failed with exit code ${code ?? "unknown"}`,
      });
    });

    child.on("error", (error) => {
      resolve({
        name: "test",
        command,
        passed: false,
        exitCode: 1,
        durationMs: Math.max(0, Date.now() - startedAt),
        error: String(error),
      });
    });
  });
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
