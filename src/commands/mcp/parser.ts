import path from "node:path";
import type { McpOptions } from "../../types/index.js";
import { getRuntimeCwd } from "../../utils/runtime.js";

export function parseMcpArgs(args: string[]): McpOptions {
  const options: McpOptions = {
    cwd: getRuntimeCwd(),
    workspace: false,
    logLevel: "info",
    transport: "stdio",
    toolTimeoutMs: 30_000,
    host: "127.0.0.1",
    authToken: undefined,
    port: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (current === "--cwd" && next) {
      options.cwd = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--cwd") throw new Error("Missing value for --cwd");
    if (current === "--workspace") {
      options.workspace = true;
      continue;
    }
    if (current === "--log-level" && next) {
      if (!["error", "warn", "info", "debug"].includes(next)) {
        throw new Error("--log-level must be error, warn, info, or debug");
      }
      options.logLevel = next as McpOptions["logLevel"];
      index += 1;
      continue;
    }
    if (current === "--log-level") throw new Error("Missing value for --log-level");
    if (current === "--transport" && next) {
      if (next !== "stdio" && next !== "sse") {
        throw new Error("--transport must be stdio or sse");
      }
      options.transport = next;
      index += 1;
      continue;
    }
    if (current === "--transport") throw new Error("Missing value for --transport");
    if (current === "--tool-timeout-ms" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--tool-timeout-ms must be a positive integer");
      }
      options.toolTimeoutMs = parsed;
      index += 1;
      continue;
    }
    if (current === "--tool-timeout-ms") {
      throw new Error("Missing value for --tool-timeout-ms");
    }
    if (current === "--port" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error("--port must be an integer between 1 and 65535");
      }
      options.port = parsed;
      options.transport = "sse";
      index += 1;
      continue;
    }
    if (current === "--port") throw new Error("Missing value for --port");
    if (current === "--host" && next) {
      options.host = next;
      options.transport = "sse";
      index += 1;
      continue;
    }
    if (current === "--host") throw new Error("Missing value for --host");
    if (current === "--auth-token" && next) {
      options.authToken = next;
      options.transport = "sse";
      index += 1;
      continue;
    }
    if (current === "--auth-token") throw new Error("Missing value for --auth-token");
    if (current.startsWith("-")) throw new Error(`Unknown mcp option: ${current}`);
    throw new Error(`Unexpected mcp argument: ${current}`);
  }

  return options;
}
