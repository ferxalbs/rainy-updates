import type { McpOptions } from "../types/index.js";
import { writeStderr } from "../utils/runtime.js";

type McpDiagnosticEvent =
  | "request.start"
  | "request.end"
  | "request.error"
  | "transport.error";

export function emitMcpDiagnostic(
  options: McpOptions,
  event: McpDiagnosticEvent,
  details: Record<string, unknown>,
): void {
  if (!options.diagJson) return;

  const payload = {
    ts: new Date().toISOString(),
    source: "rup-mcp",
    event,
    ...details,
  };
  writeStderr(`${JSON.stringify(payload)}\n`);
}
