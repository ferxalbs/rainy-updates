import { spawn } from "node:child_process";

export async function installDependencies(cwd: string, packageManager: "auto" | "npm" | "pnpm", detected: "npm" | "pnpm" | "unknown"): Promise<void> {
  const selected = packageManager === "auto" ? (detected === "unknown" ? "npm" : detected) : packageManager;

  const command = selected;
  const args = ["install"];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}
