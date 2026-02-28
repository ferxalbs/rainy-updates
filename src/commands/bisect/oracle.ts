import { spawn } from "node:child_process";
import path from "node:path";
import type { BisectOptions, BisectOutcome } from "../../types/index.js";

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

  const installResult = await runShell(
    `npm install --no-save ${packageName}@${version}`,
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

function runShell(command: string, cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const [bin, ...args] = command.split(" ");
    const child = spawn(bin, args, {
      cwd: path.resolve(cwd),
      shell: true,
      stdio: "pipe",
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}
