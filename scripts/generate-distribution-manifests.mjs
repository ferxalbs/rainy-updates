#!/usr/bin/env bun
import { $ } from "bun";
import path from "node:path";

const args = Bun.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
};

const projectRoot = path.resolve(import.meta.dir, "..");
const packageJson = await Bun.file(path.join(projectRoot, "package.json")).json();

const version = getArg("--version") || packageJson.version;
const repo = getArg("--repo") || "ferxalbs/rainy-updates";
const assetsDir = getArg("--assets-dir");
const outputDirArg = getArg("--output-dir");
const outputDir = outputDirArg ? path.resolve(process.cwd(), outputDirArg) : path.join(projectRoot, "dist", "manifests");

const description = packageJson.description;
const homepage = packageJson.homepage;

await $`mkdir -p ${outputDir}/homebrew`;
await $`mkdir -p ${outputDir}/scoop`;

async function getSha256(platform) {
  if (!assetsDir) return "REPLACE_WITH_SHA256";
  const fileName = `rup-v${version}-${platform}.tar.gz.sha256`;
  const winFileName = `rup-v${version}-${platform}.zip.sha256`;
  
  try {
    const content = await Bun.file(path.join(assetsDir, fileName)).text().catch(() => Bun.file(path.join(assetsDir, winFileName)).text());
    return content.split(" ")[0].trim();
  } catch {
    return "REPLACE_WITH_SHA256";
  }
}

const macArmSha = await getSha256("macos-arm64");
const winSha = await getSha256("windows-x64");

const brewFormula = `
class RainyUpdates < Formula
  desc "${description}"
  homepage "${homepage}"
  url "https://github.com/${repo}/releases/download/v${version}/rup-v${version}-macos-arm64.tar.gz"
  version "${version}"
  sha256 "${macArmSha}"

  def install
    bin.install "rup"
  end

  test do
    system "#{bin}/rup", "--version"
  end
end
`.trim();

await Bun.write(path.join(outputDir, "homebrew", "rup.rb"), brewFormula + "\n");

const scoopManifest = {
  version: version,
  description: description,
  homepage: homepage,
  license: "MIT",
  url: `https://github.com/${repo}/releases/download/v${version}/rup-v${version}-windows-x64.zip`,
  hash: winSha,
  bin: "rup.exe",
  checkver: {
    github: `https://github.com/${repo}`,
  },
  autoupdate: {
    url: `https://github.com/${repo}/releases/download/v$version/rup-v$version-windows-x64.zip`,
  },
};

await Bun.write(
  path.join(outputDir, "scoop", "rup.json"),
  JSON.stringify(scoopManifest, null, 2) + "\n",
);

console.log(`[generate-manifests] emitted manifests for v${version} to ${outputDir}`);
