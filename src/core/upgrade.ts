import type { UpgradeOptions, UpgradeResult } from "../types/index.js";
import { check } from "./check.js";
import { readManifest, writeManifest } from "../parsers/package-json.js";
import { installDependencies } from "../pm/install.js";

export async function upgrade(options: UpgradeOptions): Promise<UpgradeResult> {
  const checkResult = await check(options);
  if (checkResult.updates.length === 0) {
    return {
      ...checkResult,
      changed: false,
    };
  }

  const manifest = await readManifest(options.cwd);

  for (const update of checkResult.updates) {
    const section = manifest[update.kind] as Record<string, string> | undefined;
    if (!section || !section[update.name]) continue;
    section[update.name] = update.toRange;
  }

  await writeManifest(options.cwd, manifest);

  if (options.install) {
    await installDependencies(options.cwd, options.packageManager, checkResult.packageManager);
  }

  return {
    ...checkResult,
    changed: true,
    summary: {
      ...checkResult.summary,
      upgraded: checkResult.updates.length,
    },
  };
}
