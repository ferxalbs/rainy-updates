import path from "node:path";

async function runCommand(argv, cwd = process.cwd()) {
  const proc = Bun.spawn(argv, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${argv.join(" ")} failed with exit code ${exitCode}`);
  }
}

async function fileExists(filePath) {
  try {
    return await Bun.file(filePath).exists();
  } catch {
    return false;
  }
}

const cwd = process.cwd();
const distCli = path.resolve(cwd, "dist/bin/cli.js");
const compiledBase = path.resolve(cwd, "dist/rup");
const compiledBinary =
  process.platform === "win32" ? `${compiledBase}.exe` : compiledBase;

await runCommand(["bun", distCli, "--help"], cwd);
await runCommand(["bun", distCli, "--version"], cwd);

if (!(await fileExists(compiledBinary))) {
  await runCommand(["bun", "run", "build:exe"], cwd);
}

await runCommand([compiledBinary, "--help"], cwd);
await runCommand([compiledBinary, "--version"], cwd);

