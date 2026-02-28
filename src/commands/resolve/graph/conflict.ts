import type {
  PeerConflict,
  PeerConflictSeverity,
} from "../../../types/index.js";
import { parseVersion } from "../../../utils/semver.js";

interface ConflictInput {
  requester: string;
  peer: string;
  requiredRange: string;
  resolvedVersion: string;
  isInstalled: boolean;
}

/**
 * Classifies a potential peer conflict and generates a human-readable suggestion.
 *
 * Severity rules:
 *   "error"   — peer is not installed at all
 *   "error"   — resolved version is outside the required range entirely
 *               (would produce ERESOLVE in npm)
 *   "warning" — resolved version satisfies a subrange of the requirement
 *               but crosses a major boundary (soft peer warning in npm 7+)
 */
export function classifyConflict(input: ConflictInput): PeerConflict {
  const severity = determineSeverity(input);
  const suggestion = buildSuggestion(input);
  return {
    requester: input.requester,
    peer: input.peer,
    requiredRange: input.requiredRange,
    resolvedVersion: input.resolvedVersion,
    severity,
    suggestion,
  };
}

function determineSeverity(input: ConflictInput): PeerConflictSeverity {
  if (!input.isInstalled) return "error";

  // If we can parse both versions, check if they're in the same major series
  const resolved = parseVersion(input.resolvedVersion);
  const rangeVersion = extractBaseVersion(input.requiredRange);

  if (!resolved || !rangeVersion) {
    // Can't parse → assume it's a hard error to be safe
    return "error";
  }

  // Different major → ERESOLVE-level incompatibility
  if (resolved.major !== rangeVersion.major) return "error";

  // Same major but version is below the floor declared in the range → error
  // (e.g. resolved=18.1.0 required=^18.3.0 — same major but concrete floor missed)

  return "warning";
}

function extractBaseVersion(range: string): ReturnType<typeof parseVersion> {
  const stripped = range.trim().replace(/^[~^>=<]+/, "");
  return parseVersion(stripped.split(" ")[0] ?? stripped);
}

function buildSuggestion(input: ConflictInput): string {
  if (!input.isInstalled) {
    return `Install ${input.peer}@${input.requiredRange} — required by ${input.requester} but not found in the dependency tree`;
  }

  const clean = input.requiredRange.replace(/^[~^]/, "");
  return (
    `Upgrade ${input.peer} from ${input.resolvedVersion} to ${clean} ` +
    `(required by ${input.requester}: "${input.peer}": "${input.requiredRange}")`
  );
}
