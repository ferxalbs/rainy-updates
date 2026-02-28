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

export function classifyDiff(
  currentRange: string,
  nextVersion: string,
): TargetLevel {
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
    if (
      current.major === latest.major &&
      current.minor === latest.minor &&
      latest.patch > current.patch
    ) {
      return latestVersion;
    }
    return null;
  }

  if (target === "minor") {
    if (
      current.major === latest.major &&
      compareVersions(latest, current) > 0
    ) {
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

export function pickTargetVersionFromAvailable(
  currentRange: string,
  availableVersions: string[],
  latestVersion: string,
  target: TargetLevel,
): string | null {
  const current = parseVersion(currentRange);
  if (!current || target === "latest") return latestVersion;

  const parsed = availableVersions
    .map((version) => ({ raw: version, parsed: parseVersion(version) }))
    .filter(
      (item): item is { raw: string; parsed: ParsedVersion } =>
        item.parsed !== null,
    )
    .filter((item) => compareVersions(item.parsed, current) > 0)
    .sort((a, b) => compareVersions(a.parsed, b.parsed));

  if (parsed.length === 0) return null;

  if (target === "major") {
    return parsed[parsed.length - 1]?.raw ?? null;
  }

  if (target === "minor") {
    const sameMajor = parsed.filter(
      (item) => item.parsed.major === current.major,
    );
    return sameMajor.length > 0 ? sameMajor[sameMajor.length - 1].raw : null;
  }

  if (target === "patch") {
    const sameLine = parsed.filter(
      (item) =>
        item.parsed.major === current.major &&
        item.parsed.minor === current.minor,
    );
    return sameLine.length > 0 ? sameLine[sameLine.length - 1].raw : null;
  }

  return latestVersion;
}

export function applyRangeStyle(
  previousRange: string,
  version: string,
): string {
  const prefix = normalizeRangePrefix(previousRange);
  return `${prefix}${version}`;
}

const TARGET_ORDER: TargetLevel[] = ["patch", "minor", "major", "latest"];

export function clampTarget(
  requested: TargetLevel,
  maxAllowed?: TargetLevel,
): TargetLevel {
  if (!maxAllowed) return requested;
  const requestedIndex = TARGET_ORDER.indexOf(requested);
  const allowedIndex = TARGET_ORDER.indexOf(maxAllowed);
  if (requestedIndex === -1 || allowedIndex === -1) return requested;
  return TARGET_ORDER[Math.min(requestedIndex, allowedIndex)];
}

/**
 * Checks whether a concrete version satisfies a semver range expression.
 *
 * Handles the common npm range operators used in peerDependencies:
 *   exact:  "1.2.3"       → version must equal
 *   ^:      "^1.2.3"      → major must match, version must be >=
 *   ~:      "~1.2.3"      → major+minor must match, version must be >=
 *   >=:     ">=1.2.3"     → version must be >=
 *   <=:     "<=1.2.3"     → version must be <=
 *   >:      ">1.2.3"      → version must be >
 *   <:      "<1.2.3"      → version must be <
 *   *:      "*" | ""      → always true
 *   ranges: ">=1 <3"      → all space-separated clauses AND-ed together
 *
 * Does NOT handle || unions or hyphen ranges — those are rare in peerDependencies
 * and degrade gracefully (returns true to avoid false-positive conflicts).
 */
export function satisfies(version: string, range: string): boolean {
  const trimmedRange = range.trim();
  if (!trimmedRange || trimmedRange === "*") return true;

  const parsed = parseVersion(version);
  if (!parsed) return true; // non-semver versions (e.g. "latest", "workspace:*") pass through

  // Handle OR unions — split on " || " and return true if any clause matches
  if (trimmedRange.includes("||")) {
    return trimmedRange
      .split("||")
      .some((clause) => satisfies(version, clause.trim()));
  }

  // Handle AND ranges — split on whitespace and require all clauses to match
  const clauses = trimmedRange.split(/\s+/).filter(Boolean);
  if (clauses.length > 1) {
    return clauses.every((clause) => satisfies(version, clause));
  }

  const clause = clauses[0] ?? "";
  const op = parseRangeOperator(clause);
  if (!op) return true;

  const cmp = compareVersions(parsed, op.version);
  switch (op.operator) {
    case "^": {
      // same major, version >= bound
      return parsed.major === op.version.major && cmp >= 0;
    }
    case "~": {
      // same major+minor, version >= bound
      return (
        parsed.major === op.version.major &&
        parsed.minor === op.version.minor &&
        cmp >= 0
      );
    }
    case ">=":
      return cmp >= 0;
    case "<=":
      return cmp <= 0;
    case ">":
      return cmp > 0;
    case "<":
      return cmp < 0;
    case "=":
      return cmp === 0;
    default:
      return true;
  }
}

interface ParsedRangeOp {
  operator: "^" | "~" | ">=" | "<=" | ">" | "<" | "=";
  version: ParsedVersion;
}

function parseRangeOperator(clause: string): ParsedRangeOp | null {
  const ops = [">=", "<=", "^", "~", ">", "<", "="] as const;
  for (const op of ops) {
    if (clause.startsWith(op)) {
      const versionStr = clause.slice(op.length);
      const parsed = parseVersion(versionStr);
      if (parsed) return { operator: op, version: parsed };
    }
  }
  // Bare version string — treat as exact
  const parsed = parseVersion(clause);
  if (parsed) return { operator: "=", version: parsed };
  return null;
}
