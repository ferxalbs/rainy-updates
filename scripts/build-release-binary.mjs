import { $ } from "bun";
import path from "path";

const [target, outputDirArg, entrypointArg, binaryBaseNameArg, preserveOutputArg] = Bun.argv.slice(2);

if (!target || !outputDirArg) {
  throw new Error(
    "Usage: bun scripts/build-release-binary.mjs <bun-target> <output-dir>",
  );
}

const cwd = process.cwd();
const outputDir = path.resolve(cwd, outputDirArg);
const entrypoint = entrypointArg ?? "./src/bin/cli.ts";
const binaryBaseName = binaryBaseNameArg ?? "rup";
const preserveOutput = preserveOutputArg === "preserve";
const binaryName = target.includes("windows") ? `${binaryBaseName}.exe` : binaryBaseName;
const binaryPath = path.join(outputDir, binaryName);

if (!preserveOutput) {
  await $`rm -rf ${outputDir}`;
}
await $`mkdir -p ${outputDir}`;

await $`bun build ${entrypoint} --compile --target=${target} --outfile ${binaryPath}`;

for (const fileName of ["README.md", "CHANGELOG.md", "LICENSE"]) {
  const sourcePath = path.resolve(cwd, fileName);
  const targetPath = path.join(outputDir, fileName);
  await $`cp ${sourcePath} ${targetPath}`;
}

console.log(outputDir);
