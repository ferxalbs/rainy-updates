import { promises as fs } from "node:fs";
import path from "node:path";
import type { PackageDependency } from "../../types/index.js";

const LOCKFILE_PRIORITY = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "bun.lock",
] as const;

export interface AuditTarget {
  name: string;
  version: string;
  packageDir: string;
  manifestRange: string;
  resolution: "lockfile" | "manifest";
  lockfilePath?: string;
}

export interface AuditTargetResolution {
  targets: AuditTarget[];
  warnings: string[];
  resolution: {
    lockfile: number;
    manifest: number;
    unresolved: number;
  };
}

interface PackageLockData {
  packages?: Record<string, { version?: string }>;
  dependencies?: Record<string, { version?: string }>;
}

interface PnpmLockData {
  importers: Map<string, Map<string, string>>;
}

interface BunLockData {
  workspaces: Map<string, Map<string, string>>;
}

const packageLockCache = new Map<string, Promise<PackageLockData>>();
const pnpmLockCache = new Map<string, Promise<PnpmLockData>>();
const bunLockCache = new Map<string, Promise<BunLockData>>();

export function extractAuditVersion(range: string): string | null {
  const trimmed = range.trim();
  const match = trimmed.match(
    /^(?:\^|~|>=|<=|>|<|=)?\s*(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/,
  );
  return match?.[1] ?? null;
}

export async function resolveAuditTargets(
  rootCwd: string,
  packageDirs: string[],
  depsByDir: Map<string, PackageDependency[]>,
): Promise<AuditTargetResolution> {
  const warnings: string[] = [];
  const targets = new Map<string, AuditTarget>();
  const resolution = {
    lockfile: 0,
    manifest: 0,
    unresolved: 0,
  };

  for (const dir of packageDirs) {
    const deps = depsByDir.get(dir) ?? [];
    for (const dep of deps) {
      const resolved = await resolveDependencyVersion(rootCwd, dir, dep);
      if (!resolved) {
        resolution.unresolved += 1;
        continue;
      }

      const key = `${resolved.name}@${resolved.version}`;
      targets.set(key, resolved);
      if (resolved.resolution === "lockfile") {
        resolution.lockfile += 1;
      } else {
        resolution.manifest += 1;
      }
    }
  }

  if (resolution.unresolved > 0) {
    warnings.push(
      `Skipped ${resolution.unresolved} dependency range${resolution.unresolved === 1 ? "" : "s"} that could not be resolved from a lockfile or concrete manifest version.`,
    );
  }

  return {
    targets: [...targets.values()],
    warnings,
    resolution,
  };
}

async function resolveDependencyVersion(
  rootCwd: string,
  packageDir: string,
  dep: PackageDependency,
): Promise<AuditTarget | null> {
  const lockfiles = await findNearestLockfiles(rootCwd, packageDir);
  for (const lockfilePath of lockfiles) {
    const fileName = path.basename(lockfilePath);
    const version =
      fileName === "pnpm-lock.yaml"
        ? await resolveFromPnpmLock(lockfilePath, packageDir, dep.name)
        : fileName === "bun.lock"
          ? await resolveFromBunLock(lockfilePath, packageDir, dep.name)
        : await resolveFromPackageLock(lockfilePath, packageDir, dep.name);
    if (version) {
      return {
        name: dep.name,
        version,
        packageDir,
        manifestRange: dep.range,
        resolution: "lockfile",
        lockfilePath,
      };
    }
  }

  const manifestVersion = extractAuditVersion(dep.range);
  if (!manifestVersion) return null;
  return {
    name: dep.name,
    version: manifestVersion,
    packageDir,
    manifestRange: dep.range,
    resolution: "manifest",
  };
}

async function findNearestLockfiles(
  rootCwd: string,
  startDir: string,
): Promise<string[]> {
  const found: string[] = [];
  let current = startDir;

  while (true) {
    for (const fileName of LOCKFILE_PRIORITY) {
      const candidate = path.join(current, fileName);
      try {
        await fs.access(candidate);
        found.push(candidate);
      } catch {
        // ignore missing
      }
    }

    if (current === rootCwd) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return found;
}

async function resolveFromPackageLock(
  lockfilePath: string,
  packageDir: string,
  packageName: string,
): Promise<string | null> {
  const parsed = await readPackageLock(lockfilePath);
  const rootDir = path.dirname(lockfilePath);
  const relDir = normalizeRelativePath(rootDir, packageDir);
  const candidatePaths = relDir
    ? [`${relDir}/node_modules/${packageName}`, `node_modules/${packageName}`]
    : [`node_modules/${packageName}`];

  for (const key of candidatePaths) {
    const version = parsed.packages?.[key]?.version;
    if (version) return version;
  }

  if (!relDir) {
    return parsed.dependencies?.[packageName]?.version ?? null;
  }

  return parsed.dependencies?.[packageName]?.version ?? null;
}

async function resolveFromPnpmLock(
  lockfilePath: string,
  packageDir: string,
  packageName: string,
): Promise<string | null> {
  const parsed = await readPnpmLock(lockfilePath);
  const rootDir = path.dirname(lockfilePath);
  const relDir = normalizeRelativePath(rootDir, packageDir) || ".";
  const importers = [relDir, "."];

  for (const importerKey of importers) {
    const importer = parsed.importers.get(importerKey);
    const version = importer?.get(packageName);
    if (version) return version;
  }

  return null;
}

async function resolveFromBunLock(
  lockfilePath: string,
  packageDir: string,
  packageName: string,
): Promise<string | null> {
  const parsed = await readBunLock(lockfilePath);
  const rootDir = path.dirname(lockfilePath);
  const relDir = normalizeRelativePath(rootDir, packageDir);
  const workspaceKeys = [relDir, ""];

  for (const workspaceKey of workspaceKeys) {
    const workspace = parsed.workspaces.get(workspaceKey);
    const version = workspace?.get(packageName);
    if (version) return version;
  }

  return null;
}

async function readPackageLock(lockfilePath: string): Promise<PackageLockData> {
  let promise = packageLockCache.get(lockfilePath);
  if (!promise) {
    promise = fs
      .readFile(lockfilePath, "utf8")
      .then((content) => JSON.parse(content) as PackageLockData);
    packageLockCache.set(lockfilePath, promise);
  }
  return await promise;
}

async function readPnpmLock(lockfilePath: string): Promise<PnpmLockData> {
  let promise = pnpmLockCache.get(lockfilePath);
  if (!promise) {
    promise = fs.readFile(lockfilePath, "utf8").then(parsePnpmLock);
    pnpmLockCache.set(lockfilePath, promise);
  }
  return await promise;
}

async function readBunLock(lockfilePath: string): Promise<BunLockData> {
  let promise = bunLockCache.get(lockfilePath);
  if (!promise) {
    promise = fs.readFile(lockfilePath, "utf8").then(parseBunLock);
    bunLockCache.set(lockfilePath, promise);
  }
  return await promise;
}

function parsePnpmLock(content: string): PnpmLockData {
  const importers = new Map<string, Map<string, string>>();
  const lines = content.split(/\r?\n/);

  let inImporters = false;
  let currentImporter: string | null = null;
  let inDependencySection = false;
  let currentPackageName: string | null = null;

  for (const rawLine of lines) {
    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (indent === 0) {
      inImporters = trimmed === "importers:";
      currentImporter = null;
      inDependencySection = false;
      currentPackageName = null;
      continue;
    }

    if (!inImporters) continue;

    if (indent === 2 && trimmed.endsWith(":")) {
      currentImporter = trimYamlKey(trimmed.slice(0, -1));
      importers.set(currentImporter, new Map());
      inDependencySection = false;
      currentPackageName = null;
      continue;
    }

    if (!currentImporter) continue;

    if (indent === 4 && trimmed.endsWith(":")) {
      const key = trimYamlKey(trimmed.slice(0, -1));
      inDependencySection =
        key === "dependencies" ||
        key === "devDependencies" ||
        key === "optionalDependencies";
      currentPackageName = null;
      continue;
    }

    if (!inDependencySection) continue;

    if (indent === 6) {
      currentPackageName = null;
      const separator = trimmed.indexOf(":");
      if (separator === -1) continue;
      const key = trimYamlKey(trimmed.slice(0, separator));
      const value = trimmed.slice(separator + 1).trim();
      if (!value) {
        currentPackageName = key;
        continue;
      }
      const version = normalizePnpmVersion(value);
      if (version) {
        importers.get(currentImporter)?.set(key, version);
      }
      continue;
    }

    if (indent === 8 && currentPackageName && trimmed.startsWith("version:")) {
      const version = normalizePnpmVersion(trimmed.slice("version:".length));
      if (version) {
        importers.get(currentImporter)?.set(currentPackageName, version);
      }
    }
  }

  return { importers };
}

function parseBunLock(content: string): BunLockData {
  const workspaces = new Map<string, Map<string, string>>();
  const lines = content.split(/\r?\n/);

  let inWorkspaces = false;
  let currentWorkspace = "";
  let currentSection: "dependencies" | "devDependencies" | "optionalDependencies" | null =
    null;

  for (const rawLine of lines) {
    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (!inWorkspaces && trimmed === '"workspaces": {') {
      inWorkspaces = true;
      currentWorkspace = "";
      currentSection = null;
      continue;
    }

    if (inWorkspaces && indent <= 2 && trimmed === "},") {
      inWorkspaces = false;
      currentWorkspace = "";
      currentSection = null;
      continue;
    }

    if (indent === 4 && trimmed.endsWith("{")) {
      const keyMatch = trimmed.match(/^"([^"]*)": \{$/);
      if (!keyMatch) continue;
      currentWorkspace = keyMatch[1] === "" ? "" : keyMatch[1];
      workspaces.set(currentWorkspace, new Map());
      currentSection = null;
      continue;
    }

    if (!workspaces.has(currentWorkspace)) continue;

    if (indent === 6 && trimmed.endsWith("{")) {
      const keyMatch = trimmed.match(
        /^"(dependencies|devDependencies|optionalDependencies)": \{$/,
      );
      const sectionName = keyMatch?.[1];
      currentSection =
        sectionName === "dependencies" ||
        sectionName === "devDependencies" ||
        sectionName === "optionalDependencies"
          ? sectionName
          : null;
      continue;
    }

    if (!currentSection) continue;

    if (indent === 8) {
      const depMatch = trimmed.match(/^"([^"]+)": "([^"]+)",?$/);
      if (!depMatch) continue;
      const packageName = depMatch[1];
      const version = extractAuditVersion(depMatch[2]);
      if (version) {
        workspaces.get(currentWorkspace)?.set(packageName, version);
      }
    }
  }

  return { workspaces };
}

function normalizeRelativePath(rootDir: string, targetDir: string): string {
  const relative = path.relative(rootDir, targetDir).replace(/\\/g, "/");
  return relative === "" ? "" : relative;
}

function normalizePnpmVersion(value: string): string | null {
  const cleaned = trimYamlKey(value.trim());
  const base = cleaned.split("(")[0] ?? cleaned;
  const match = base.match(/^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
  return match?.[1] ?? null;
}

function trimYamlKey(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}
