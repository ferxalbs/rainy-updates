import type { RiskFactor } from "../../types/index.js";
import type { RiskInput } from "../types.js";

const MUTABLE_PATTERNS = [
  "git+",
  "github:",
  "gitlab:",
  "http://",
  "https://",
  "git://",
];

export function detectMutableSourceRisk(input: RiskInput): RiskFactor | null {
  const raw = input.update.fromRange;
  if (!MUTABLE_PATTERNS.some((pattern) => raw.startsWith(pattern))) {
    return null;
  }

  const immutableCommitPinned = /#[a-f0-9]{7,40}$/i.test(raw);
  if (immutableCommitPinned) {
    return null;
  }

  return {
    code: "mutable-source",
    weight: 25,
    category: "behavioral-risk",
    message: "Dependency uses a mutable git/http source without an immutable commit pin.",
  };
}
