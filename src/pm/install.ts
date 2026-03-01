export async function installDependencies(
  cwd: string,
  packageManager: "auto" | "npm" | "pnpm",
  detected: "npm" | "pnpm" | "unknown",
): Promise<void> {
  const selected =
    packageManager === "auto"
      ? detected === "unknown"
        ? "npm"
        : detected
      : packageManager;

  const command = selected;
  const args = ["install"];

  try {
    const proc = Bun.spawn([command, ...args], {
      cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const code = await proc.exited;
    if (code !== 0) {
      throw new Error(
        `${command} ${args.join(" ")} failed with exit code ${code}`,
      );
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}
