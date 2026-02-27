import { promises as fs } from "node:fs";
import path from "node:path";
import type { TargetLevel } from "../types/index.js";

export interface PolicyConfig {
  ignore?: string[];
  packageRules?: Record<
    string,
    {
      maxTarget?: TargetLevel;
      ignore?: boolean;
    }
  >;
}

export interface ResolvedPolicy {
  ignorePatterns: string[];
  packageRules: Map<string, { maxTarget?: TargetLevel; ignore: boolean }>;
}

export async function loadPolicy(cwd: string, policyFile?: string): Promise<ResolvedPolicy> {
  const candidates = policyFile ? [policyFile] : [
    path.join(cwd, ".rainyupdates-policy.json"),
    path.join(cwd, "rainy-updates.policy.json"),
  ];

  for (const candidate of candidates) {
    const filePath = path.isAbsolute(candidate) ? candidate : path.resolve(cwd, candidate);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(content) as PolicyConfig;
      return {
        ignorePatterns: parsed.ignore ?? [],
        packageRules: new Map(
          Object.entries(parsed.packageRules ?? {}).map(([pkg, rule]) => [
            pkg,
            {
              maxTarget: rule.maxTarget,
              ignore: rule.ignore === true,
            },
          ]),
        ),
      };
    } catch {
      // noop
    }
  }

  return {
    ignorePatterns: [],
    packageRules: new Map(),
  };
}
