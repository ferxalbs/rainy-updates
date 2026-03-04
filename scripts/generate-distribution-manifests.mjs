import { mkdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1];
}

const version =
  readArg("--version") ||
  String((await Bun.file(path.resolve("package.json")).json()).version ?? "").trim();
const repo = readArg("--repo", "ferxalbs/rainy-updates");
const assetsDir = path.resolve(readArg("--assets-dir", "dist/assets"));
const outputDir = path.resolve(readArg("--output-dir", "dist/distribution"));

if (!version) {
  throw new Error("Missing version. Pass --version or set package.json version.");
}

const tag = version.startsWith("v") ? version : `v${version}`;
const normalizedVersion = tag.slice(1);

const assetDefinitions = {
  macosArm64: {
    archive: `rup-${tag}-macos-arm64.tar.gz`,
    url: `https://github.com/${repo}/releases/download/${tag}/rup-${tag}-macos-arm64.tar.gz`,
  },
  macosX64: {
    archive: `rup-${tag}-macos-x64.tar.gz`,
    url: `https://github.com/${repo}/releases/download/${tag}/rup-${tag}-macos-x64.tar.gz`,
  },
  linuxArm64: {
    archive: `rup-${tag}-linux-arm64.tar.gz`,
    url: `https://github.com/${repo}/releases/download/${tag}/rup-${tag}-linux-arm64.tar.gz`,
  },
  linuxX64: {
    archive: `rup-${tag}-linux-x64.tar.gz`,
    url: `https://github.com/${repo}/releases/download/${tag}/rup-${tag}-linux-x64.tar.gz`,
  },
  windowsX64: {
    archive: `rup-${tag}-windows-x64.zip`,
    url: `https://github.com/${repo}/releases/download/${tag}/rup-${tag}-windows-x64.zip`,
  },
};

const checksums = await Promise.all(
  Object.entries(assetDefinitions).map(async ([key, value]) => {
    const shaPath = path.join(assetsDir, `${value.archive}.sha256`);
    const shaContent = (await Bun.file(shaPath).text()).trim();
    const hash = shaContent.split(/\s+/)[0];
    if (!hash) {
      throw new Error(`Unable to read checksum from ${shaPath}`);
    }
    return [key, { ...value, sha256: hash }];
  }),
);

const assets = Object.fromEntries(checksums);

const homebrewFormula = `class Rup < Formula
  desc "Deterministic dependency review and upgrade operator for Node monorepos and CI"
  homepage "https://github.com/${repo}"
  license "MIT"
  version "${normalizedVersion}"

  on_macos do
    if Hardware::CPU.arm?
      url "${assets.macosArm64.url}"
      sha256 "${assets.macosArm64.sha256}"
    else
      url "${assets.macosX64.url}"
      sha256 "${assets.macosX64.sha256}"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "${assets.linuxArm64.url}"
      sha256 "${assets.linuxArm64.sha256}"
    else
      url "${assets.linuxX64.url}"
      sha256 "${assets.linuxX64.sha256}"
    end
  end

  def install
    bin.install "rup"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/rup --version")
  end
end
`;

const scoopManifest = {
  version: normalizedVersion,
  description:
    "Deterministic dependency review and upgrade operator for Node monorepos and CI.",
  homepage: `https://github.com/${repo}`,
  license: "MIT",
  architecture: {
    "64bit": {
      url: assets.windowsX64.url,
      hash: assets.windowsX64.sha256,
    },
  },
  bin: "rup.exe",
  checkver: {
    github: `https://github.com/${repo}`,
  },
  autoupdate: {
    architecture: {
      "64bit": {
        url: `https://github.com/${repo}/releases/download/v$version/rup-v$version-windows-x64.zip`,
      },
    },
  },
};

await mkdir(path.join(outputDir, "homebrew"), { recursive: true });
await mkdir(path.join(outputDir, "scoop"), { recursive: true });

await Bun.write(
  path.join(outputDir, "homebrew", "rup.rb"),
  homebrewFormula,
);
await Bun.write(
  path.join(outputDir, "scoop", "rup.json"),
  `${JSON.stringify(scoopManifest, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      version: normalizedVersion,
      repo,
      outputDir,
      files: [
        path.join(outputDir, "homebrew", "rup.rb"),
        path.join(outputDir, "scoop", "rup.json"),
      ],
    },
    null,
    2,
  ),
);
