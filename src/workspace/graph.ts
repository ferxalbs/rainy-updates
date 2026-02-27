import type { DependencyKind, PackageManifest } from "../types/index.js";

export interface WorkspaceNode {
  packagePath: string;
  packageName: string;
  dependsOn: string[];
}

export interface WorkspaceGraphResult {
  nodes: WorkspaceNode[];
  orderedPaths: string[];
  localPackageNames: Set<string>;
  cycles: string[][];
}

export function buildWorkspaceGraph(
  manifestsByPath: Map<string, PackageManifest>,
  includeKinds: DependencyKind[],
): WorkspaceGraphResult {
  const nodes: WorkspaceNode[] = [];
  const localPackageNames = new Set<string>();

  for (const manifest of manifestsByPath.values()) {
    if (typeof manifest.name === "string" && manifest.name.length > 0) {
      localPackageNames.add(manifest.name);
    }
  }

  for (const [packagePath, manifest] of manifestsByPath) {
    const packageName = typeof manifest.name === "string" ? manifest.name : packagePath;
    const dependsOn = new Set<string>();

    for (const kind of includeKinds) {
      const section = manifest[kind] as Record<string, string> | undefined;
      if (!section) continue;

      for (const [depName, depRange] of Object.entries(section)) {
        if (!localPackageNames.has(depName)) continue;
        if (depRange.startsWith("workspace:")) continue;
        dependsOn.add(depName);
      }
    }

    nodes.push({
      packagePath,
      packageName,
      dependsOn: Array.from(dependsOn),
    });
  }

  const byName = new Map(nodes.map((node) => [node.packageName, node]));
  const inDegree = new Map<string, number>();
  const edges = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.packageName, 0);
    edges.set(node.packageName, []);
  }

  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      if (!byName.has(dep)) continue;
      const list = edges.get(dep);
      if (list) list.push(node.packageName);
      inDegree.set(node.packageName, (inDegree.get(node.packageName) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const orderedNames: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    orderedNames.push(current);

    for (const next of edges.get(current) ?? []) {
      const degree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, degree);
      if (degree === 0) queue.push(next);
    }
  }

  const cycles: string[][] = [];
  if (orderedNames.length !== nodes.length) {
    const remaining = nodes
      .map((node) => node.packageName)
      .filter((name) => !orderedNames.includes(name));
    if (remaining.length > 0) cycles.push(remaining);
  }

  const orderedPaths = orderedNames
    .map((name) => byName.get(name))
    .filter((node): node is WorkspaceNode => Boolean(node))
    .map((node) => node.packagePath);

  for (const node of nodes) {
    if (!orderedPaths.includes(node.packagePath)) {
      orderedPaths.push(node.packagePath);
    }
  }

  return {
    nodes,
    orderedPaths,
    localPackageNames,
    cycles,
  };
}
