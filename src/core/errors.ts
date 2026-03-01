export type ErrorCode =
  | "REGISTRY_ERROR"
  | "AUTH_ERROR"
  | "ADVISORY_SOURCE_DEGRADED"
  | "ADVISORY_SOURCE_DOWN"
  | "CACHE_BACKEND_FALLBACK";

export type ErrorValidity = "partial" | "invalid" | "intact";

export interface ClassifiedMessageInput {
  code: ErrorCode;
  whatFailed: string;
  intact: string;
  validity: ErrorValidity;
  next: string;
}

export function formatClassifiedMessage(input: ClassifiedMessageInput): string {
  return `[${input.code}] ${input.whatFailed} Intact: ${input.intact} Result: ${input.validity}. Next: ${input.next}`;
}

export function hasErrorCode(value: string, code: ErrorCode): boolean {
  return value.startsWith(`[${code}]`);
}
