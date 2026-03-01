import type { RiskFactor } from "../../types/index.js";
import type { RiskContext, RiskInput } from "../types.js";

const HIGH_VALUE_PACKAGES = [
  "react",
  "react-dom",
  "next",
  "typescript",
  "lodash",
  "axios",
  "zod",
  "vite",
  "eslint",
  "express",
];

export function detectTyposquatRisk(
  input: RiskInput,
  context: RiskContext,
): RiskFactor | null {
  const target = normalizeName(input.update.name);
  if (target.length < 4) return null;

  const candidates = new Set([
    ...HIGH_VALUE_PACKAGES,
    ...Array.from(context.knownPackageNames),
  ]);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeName(candidate);
    if (!normalizedCandidate || normalizedCandidate === target) continue;
    if (Math.abs(normalizedCandidate.length - target.length) > 1) continue;
    if (isTransposition(normalizedCandidate, target) || levenshtein(normalizedCandidate, target) === 1) {
      return {
        code: "typosquat-heuristic",
        weight: 25,
        category: "behavioral-risk",
        message: `Package name is highly similar to "${candidate}", which may indicate typosquatting.`,
      };
    }
  }

  return null;
}

function normalizeName(value: string): string {
  const trimmed = value.startsWith("@") ? value.split("/")[1] ?? value : value;
  return trimmed.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isTransposition(left: string, right: string): boolean {
  if (left.length !== right.length || left === right) return false;
  const mismatches: number[] = [];
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) mismatches.push(index);
    if (mismatches.length > 2) return false;
  }
  if (mismatches.length !== 2) return false;
  const [first, second] = mismatches;
  return left[first] === right[second] && left[second] === right[first];
}

function levenshtein(left: string, right: string): number {
  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  for (let i = 0; i <= left.length; i += 1) matrix[i]![0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0]![j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[left.length]![right.length]!;
}
