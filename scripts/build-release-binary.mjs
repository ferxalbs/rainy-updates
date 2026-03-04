import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const [target, outputDirArg] = process.argv.slice(2);

if (!target || !outputDirArg) {
  throw new Error(
    "Usage: bun scripts/build-release-binary.mjs <bun-target> <output-dir>",
  );
}

const cwd = process.cwd();
const outputDir = path.resolve(cwd, outputDirArg);
const binaryName = target.includes("windows") ? "rup.exe" : "rup";
const binaryPath = path.join(outputDir, binaryName);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const build = Bun.spawn(
  [
    "bun",
    "build",
    "./src/bin/cli.ts",
    "--compile",
    `--target=${target}`,
    "--outfile",
    binaryPath,
  ],
  {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  },
);

const exitCode = await build.exited;
if (exitCode !== 0) {
  throw new Error(`bun build failed for target ${target} with exit code ${exitCode}`);
}

for (const fileName of ["README.md", "CHANGELOG.md", "LICENSE"]) {
  const sourcePath = path.resolve(cwd, fileName);
  const targetPath = path.join(outputDir, fileName);
  await Bun.write(targetPath, Bun.file(sourcePath));
}

console.log(outputDir);

