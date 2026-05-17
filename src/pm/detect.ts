import path from "node:path";
import type {
  DetectedPackageManager,
  PackageManifest,
  SelectedPackageManager,
  SupportedPackageManager,
} from "../types/index.js";

const PACKAGE_MANAGER_LOCKFILES: Array<[string, SupportedPackageManager]> = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["npm-shrinkwrap.json", "npm"],
  ["yarn.lock", "yarn"],
];

export type PackageManagerDetectionSource =
  | "packageManager-field"
  | "lockfile"
  | "fallback";
export type YarnFlavor = "classic" | "berry" | "unknown";

export interface PackageManagerDetection {
  manager: DetectedPackageManager;
  source: PackageManagerDetectionSource;
  lockfile?: string;
  packageManagerField?: string;
  yarnFlavor?: YarnFlavor;
}

export interface PackageManagerProfile {
  manager: SupportedPackageManager;
  command: SupportedPackageManager;
  source: PackageManagerDetectionSource;
  lockfile?: string;
  packageManagerField?: string;
  yarnFlavor?: YarnFlavor;
}

export async function detectPackageManager(
  cwd: string,
): Promise<DetectedPackageManager> {
  return (await detectPackageManagerDetails(cwd)).manager;
}

export async function detectPackageManagerDetails(
  cwd: string,
): Promise<PackageManagerDetection> {
  const packageManagerField = await readPackageManagerField(cwd);
  if (packageManagerField) {
    const parsed = parsePackageManagerField(packageManagerField);
    if (parsed) {
      return {
        manager: parsed.manager,
        source: "packageManager-field",
        packageManagerField,
        yarnFlavor: parsed.yarnFlavor,
      };
    }
  }

  for (const [lockfile, packageManager] of PACKAGE_MANAGER_LOCKFILES) {
    if (await fileExists(path.join(cwd, lockfile))) {
      return {
        manager: packageManager,
        source: "lockfile",
        lockfile,
        yarnFlavor: packageManager === "yarn" ? "unknown" : undefined,
      };
    }
  }

  return {
    manager: "unknown",
    source: "fallback",
    packageManagerField: packageManagerField ?? undefined,
  };
}

export function resolvePackageManager(
  requested: SelectedPackageManager,
  detected: DetectedPackageManager,
  fallback: SupportedPackageManager = "npm",
): SupportedPackageManager {
  if (requested !== "auto") return requested;
  if (detected !== "unknown") return detected;
  return fallback;
}

export async function resolvePackageManagerProfile(
  cwd: string,
  requested: SelectedPackageManager,
  fallback: SupportedPackageManager = "npm",
): Promise<PackageManagerProfile> {
  const detected = await detectPackageManagerDetails(cwd);
  return createPackageManagerProfile(requested, detected, fallback);
}

export function createPackageManagerProfile(
  requested: SelectedPackageManager,
  detected: PackageManagerDetection,
  fallback: SupportedPackageManager = "npm",
): PackageManagerProfile {
  const manager = resolvePackageManager(requested, detected.manager, fallback);
  return {
    manager,
    command: manager,
    source:
      requested === "auto" && detected.manager !== "unknown"
        ? detected.source
        : "fallback",
    lockfile: detected.lockfile,
    packageManagerField: detected.packageManagerField,
    yarnFlavor:
      manager === "yarn" ? detected.yarnFlavor ?? inferYarnFlavor(undefined) : undefined,
  };
}

export function buildInstallInvocation(
  profile: PackageManagerProfile,
  options: { frozen?: boolean; ci?: boolean } = {},
): { command: string; args: string[]; display: string } {
  const args =
    profile.manager === "bun"
      ? ["install", ...(options.frozen ? ["--frozen-lockfile"] : [])]
      : profile.manager === "pnpm"
        ? ["install", ...(options.frozen ? ["--frozen-lockfile"] : [])]
        : profile.manager === "yarn"
          ? [
              "install",
              ...(options.frozen
                ? [
                    profile.yarnFlavor === "berry"
                      ? "--immutable"
                      : "--frozen-lockfile",
                  ]
                : []),
            ]
          : options.ci || options.frozen
            ? ["ci"]
            : ["install"];

  return {
    command: profile.command,
    args,
    display: [profile.command, ...args].join(" "),
  };
}

export function buildAddInvocation(
  profile: PackageManagerProfile,
  packages: string[],
  options: { exact?: boolean; noSave?: boolean } = {},
): { command: string; args: string[]; display: string } {
  const args =
    profile.manager === "bun"
      ? [
          "add",
          ...(options.exact ? ["--exact"] : []),
          ...(options.noSave ? ["--no-save"] : []),
          ...packages,
        ]
      : profile.manager === "pnpm"
        ? [
            "add",
            ...(options.exact ? ["--save-exact"] : []),
            ...(options.noSave ? ["--no-save"] : []),
            ...packages,
          ]
        : profile.manager === "yarn"
          ? ["add", ...(options.exact ? ["--exact"] : []), ...packages]
          : [
              "install",
              ...(options.noSave ? ["--no-save"] : []),
              ...(options.exact ? ["--save-exact"] : []),
              ...packages,
            ];

  return {
    command: profile.command,
    args,
    display: [profile.command, ...args].join(" "),
  };
}

export function buildTestCommand(profile: PackageManagerProfile): string {
  return `${profile.command} test`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await Bun.file(filePath).exists();
  } catch {
    return false;
  }
}

async function readPackageManagerField(cwd: string): Promise<string | null> {
  const packageJsonPath = path.join(cwd, "package.json");

  try {
    const manifest = (await Bun.file(packageJsonPath).json()) as PackageManifest;
    return typeof manifest.packageManager === "string"
      ? manifest.packageManager
      : null;
  } catch {
    return null;
  }
}

function parsePackageManagerField(
  value: string,
): { manager: SupportedPackageManager; yarnFlavor?: YarnFlavor } | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const [name, version] = trimmed.split("@", 2);
  if (name !== "bun" && name !== "npm" && name !== "pnpm" && name !== "yarn") {
    return null;
  }

  return {
    manager: name,
    yarnFlavor: name === "yarn" ? inferYarnFlavor(version) : undefined,
  };
}

function inferYarnFlavor(version: string | undefined): YarnFlavor {
  if (!version) return "unknown";
  const match = version.match(/^(\d+)/);
  if (!match) return "unknown";
  return Number(match[1]) >= 2 ? "berry" : "classic";
}
