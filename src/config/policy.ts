import { promises as fs } from "node:fs";
import path from "node:path";
import type { TargetLevel } from "../types/index.js";

export interface PolicyConfig {
  ignore?: string[];
  cooldownDays?: number;
  packageRules?: Record<
    string,
    {
      match?: string;
      maxTarget?: TargetLevel;
      ignore?: boolean;
      maxUpdatesPerRun?: number;
      cooldownDays?: number;
      allowPrerelease?: boolean;
      group?: string;
      priority?: number;
    }
  >;
}

export interface PolicyRule {
  match?: string;
  maxTarget?: TargetLevel;
  ignore: boolean;
  maxUpdatesPerRun?: number;
  cooldownDays?: number;
  allowPrerelease?: boolean;
  group?: string;
  priority?: number;
}

export interface ResolvedPolicy {
  ignorePatterns: string[];
  cooldownDays?: number;
  packageRules: Map<string, PolicyRule>;
  matchRules: PolicyRule[];
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
        cooldownDays: asNonNegativeInt(parsed.cooldownDays),
        packageRules: new Map(Object.entries(parsed.packageRules ?? {}).map(([pkg, rule]) => [pkg, normalizeRule(rule)])),
        matchRules: Object.values(parsed.packageRules ?? {})
          .map((rule) => normalizeRule(rule))
          .filter((rule) => typeof rule.match === "string" && rule.match.length > 0),
      };
    } catch {
      // noop
    }
  }

  return {
    ignorePatterns: [],
    cooldownDays: undefined,
    packageRules: new Map(),
    matchRules: [],
  };
}

export function resolvePolicyRule(packageName: string, policy: ResolvedPolicy): PolicyRule | undefined {
  const exact = policy.packageRules.get(packageName);
  if (exact) return exact;
  return policy.matchRules.find((rule) => matchesPattern(packageName, rule.match));
}

function normalizeRule(rule: {
  match?: string;
  maxTarget?: TargetLevel;
  ignore?: boolean;
  maxUpdatesPerRun?: number;
  cooldownDays?: number;
  allowPrerelease?: boolean;
  group?: string;
  priority?: number;
}): PolicyRule {
  return {
    match: typeof rule.match === "string" ? rule.match : undefined,
    maxTarget: rule.maxTarget,
    ignore: rule.ignore === true,
    maxUpdatesPerRun: asNonNegativeInt(rule.maxUpdatesPerRun),
    cooldownDays: asNonNegativeInt(rule.cooldownDays),
    allowPrerelease: rule.allowPrerelease === true,
    group: typeof rule.group === "string" && rule.group.trim().length > 0 ? rule.group.trim() : undefined,
    priority: asNonNegativeInt(rule.priority),
  };
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return undefined;
  return value;
}

function matchesPattern(value: string, pattern?: string): boolean {
  if (!pattern || pattern.length === 0) return false;
  if (pattern === "*") return true;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(value);
}
