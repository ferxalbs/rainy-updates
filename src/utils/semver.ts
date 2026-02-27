import type { TargetLevel } from "../types/index.js";

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

export function normalizeRangePrefix(range: string): string {
  const trimmed = range.trim();
  if (!trimmed) return "";
  const prefixes = ["^", "~", ">=", "<=", ">", "<", "="];
  const prefix = prefixes.find((item) => trimmed.startsWith(item));
  return prefix ?? "";
}

export function parseVersion(raw: string): ParsedVersion | null {
  const clean = raw.trim().replace(/^[~^]/, "").split("-")[0];
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export function classifyDiff(currentRange: string, nextVersion: string): TargetLevel {
  const current = parseVersion(currentRange);
  const next = parseVersion(nextVersion);
  if (!current || !next) return "latest";
  if (next.major > current.major) return "major";
  if (next.minor > current.minor) return "minor";
  if (next.patch > current.patch) return "patch";
  return "latest";
}

export function pickTargetVersion(
  currentRange: string,
  latestVersion: string,
  target: TargetLevel,
): string | null {
  const current = parseVersion(currentRange);
  const latest = parseVersion(latestVersion);

  if (!latest) return null;
  if (!current || target === "latest") return latestVersion;

  if (target === "patch") {
    if (current.major === latest.major && current.minor === latest.minor && latest.patch > current.patch) {
      return latestVersion;
    }
    return null;
  }

  if (target === "minor") {
    if (current.major === latest.major && compareVersions(latest, current) > 0) {
      return latestVersion;
    }
    return null;
  }

  if (target === "major") {
    if (compareVersions(latest, current) > 0) {
      return latestVersion;
    }
    return null;
  }

  return latestVersion;
}

export function applyRangeStyle(previousRange: string, version: string): string {
  const prefix = normalizeRangePrefix(previousRange);
  return `${prefix}${version}`;
}

const TARGET_ORDER: TargetLevel[] = ["patch", "minor", "major", "latest"];

export function clampTarget(requested: TargetLevel, maxAllowed?: TargetLevel): TargetLevel {
  if (!maxAllowed) return requested;
  const requestedIndex = TARGET_ORDER.indexOf(requested);
  const allowedIndex = TARGET_ORDER.indexOf(maxAllowed);
  if (requestedIndex === -1 || allowedIndex === -1) return requested;
  return TARGET_ORDER[Math.min(requestedIndex, allowedIndex)];
}
