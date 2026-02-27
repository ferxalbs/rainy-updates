import { promises as fs } from "node:fs";
import path from "node:path";
import type { BaselineOptions, DependencyKind } from "../types/index.js";
import { collectDependencies, readManifest } from "../parsers/package-json.js";
import { discoverPackageDirs } from "../workspace/discover.js";

interface BaselineEntry {
  packagePath: string;
  kind: DependencyKind;
  name: string;
  range: string;
}

interface BaselineFile {
  version: 1;
  createdAt: string;
  entries: BaselineEntry[];
}

export interface BaselineSaveResult {
  filePath: string;
  entries: number;
}

export interface BaselineDiffResult {
  filePath: string;
  added: BaselineEntry[];
  removed: BaselineEntry[];
  changed: Array<{ before: BaselineEntry; after: BaselineEntry }>;
}

export async function saveBaseline(options: BaselineOptions): Promise<BaselineSaveResult> {
  const entries = await collectBaselineEntries(options.cwd, options.workspace, options.includeKinds);
  const payload: BaselineFile = {
    version: 1,
    createdAt: new Date().toISOString(),
    entries,
  };

  await fs.mkdir(path.dirname(options.filePath), { recursive: true });
  await fs.writeFile(options.filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  return {
    filePath: options.filePath,
    entries: entries.length,
  };
}

export async function diffBaseline(options: BaselineOptions): Promise<BaselineDiffResult> {
  const content = await fs.readFile(options.filePath, "utf8");
  const baseline = JSON.parse(content) as BaselineFile;
  const currentEntries = await collectBaselineEntries(options.cwd, options.workspace, options.includeKinds);

  const baselineMap = new Map(baseline.entries.map((entry) => [toKey(entry), entry]));
  const currentMap = new Map(currentEntries.map((entry) => [toKey(entry), entry]));

  const added: BaselineEntry[] = [];
  const removed: BaselineEntry[] = [];
  const changed: Array<{ before: BaselineEntry; after: BaselineEntry }> = [];

  for (const [key, current] of currentMap) {
    const base = baselineMap.get(key);
    if (!base) {
      added.push(current);
      continue;
    }
    if (base.range !== current.range) {
      changed.push({ before: base, after: current });
    }
  }

  for (const [key, base] of baselineMap) {
    if (!currentMap.has(key)) {
      removed.push(base);
    }
  }

  return {
    filePath: options.filePath,
    added: sortEntries(added),
    removed: sortEntries(removed),
    changed: changed.sort((a, b) => toKey(a.after).localeCompare(toKey(b.after))),
  };
}

async function collectBaselineEntries(
  cwd: string,
  workspace: boolean,
  includeKinds: DependencyKind[],
): Promise<BaselineEntry[]> {
  const packageDirs = await discoverPackageDirs(cwd, workspace);
  const entries: BaselineEntry[] = [];

  for (const packageDir of packageDirs) {
    const manifest = await readManifest(packageDir);
    const deps = collectDependencies(manifest, includeKinds);
    for (const dep of deps) {
      entries.push({
        packagePath: path.relative(cwd, packageDir) || ".",
        kind: dep.kind,
        name: dep.name,
        range: dep.range,
      });
    }
  }

  return sortEntries(entries);
}

function toKey(entry: BaselineEntry): string {
  return `${entry.packagePath}::${entry.kind}::${entry.name}`;
}

function sortEntries(entries: BaselineEntry[]): BaselineEntry[] {
  return [...entries].sort((a, b) => toKey(a).localeCompare(toKey(b)));
}
