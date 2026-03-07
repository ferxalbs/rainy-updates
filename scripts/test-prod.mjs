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
const distMcp = path.resolve(cwd, "dist/bin/mcp.js");
const compiledBase = path.resolve(cwd, "dist/rup");
const compiledBinary =
  process.platform === "win32" ? `${compiledBase}.exe` : compiledBase;
const compiledMcpBase = path.resolve(cwd, "dist/rup-mcp");
const compiledMcpBinary =
  process.platform === "win32" ? `${compiledMcpBase}.exe` : compiledMcpBase;

await runCommand(["bun", distCli, "--help"], cwd);
await runCommand(["bun", distCli, "--version"], cwd);
await runCommand(["bun", distMcp, "--help"], cwd);
await runCommand(["bun", distMcp, "--version"], cwd);

if (!(await fileExists(compiledBinary)) || !(await fileExists(compiledMcpBinary))) {
  await runCommand(["bun", "run", "build:exe"], cwd);
}

await runCommand([compiledBinary, "--help"], cwd);
await runCommand([compiledBinary, "--version"], cwd);
await runCommand([compiledMcpBinary, "--help"], cwd);
await runCommand([compiledMcpBinary, "--version"], cwd);
