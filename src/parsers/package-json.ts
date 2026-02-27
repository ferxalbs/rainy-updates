import { promises as fs } from "node:fs";
import path from "node:path";
import type { DependencyKind, PackageDependency, PackageManifest } from "../types/index.js";

const DEPENDENCY_KINDS: DependencyKind[] = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

export function getPackageJsonPath(cwd: string): string {
  return path.join(cwd, "package.json");
}

export async function readManifest(cwd: string): Promise<PackageManifest> {
  const filePath = getPackageJsonPath(cwd);
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as PackageManifest;
}

export async function writeManifest(cwd: string, manifest: PackageManifest): Promise<void> {
  const filePath = getPackageJsonPath(cwd);
  const content = JSON.stringify(manifest, null, 2) + "\n";
  await fs.writeFile(filePath, content, "utf8");
}

export function collectDependencies(manifest: PackageManifest, includeKinds: DependencyKind[]): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (const kind of DEPENDENCY_KINDS) {
    if (!includeKinds.includes(kind)) continue;
    const section = manifest[kind];
    if (!section || typeof section !== "object") continue;

    for (const [name, range] of Object.entries(section as Record<string, string>)) {
      deps.push({ name, range, kind });
    }
  }

  return deps;
}
