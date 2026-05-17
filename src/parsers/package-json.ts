import path from "node:path";
import type {
  DependencyKind,
  PackageDependency,
  PackageManifest,
} from "../types/index.js";

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
  if (typeof Bun !== "undefined") {
    return (await Bun.file(filePath).json()) as PackageManifest;
  }
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as PackageManifest;
}

export async function writeManifest(
  cwd: string,
  manifest: PackageManifest,
): Promise<void> {
  const filePath = getPackageJsonPath(cwd);
  const content = JSON.stringify(manifest, null, 2) + "\n";
  if (typeof Bun !== "undefined") {
    await Bun.write(filePath, content);
  } else {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, content);
  }
}

export function collectDependencies(
  manifest: PackageManifest,
  includeKinds: DependencyKind[],
): PackageDependency[] {
  const deps: PackageDependency[] = [];

  for (const kind of DEPENDENCY_KINDS) {
    if (!includeKinds.includes(kind)) continue;
    const section = manifest[kind];
    if (!section || typeof section !== "object") continue;

    for (const [name, range] of Object.entries(
      section as Record<string, string>,
    )) {
      deps.push({ name, range, kind });
    }
  }

  return deps;
}
