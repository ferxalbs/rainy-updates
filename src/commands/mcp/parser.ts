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
    initializeTimeoutMs: 10_000,
    maxInflight: 4,
    maxQueue: 64,
    httpMode: "stateless",
    diagJson: false,
    host: "127.0.0.1",
    authToken: undefined,
    port: undefined,
    httpPath: "/mcp",
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
      if (next !== "stdio" && next !== "http") {
        throw new Error("--transport must be stdio or http");
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
    if (current === "--initialize-timeout-ms" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--initialize-timeout-ms must be a positive integer");
      }
      options.initializeTimeoutMs = parsed;
      index += 1;
      continue;
    }
    if (current === "--initialize-timeout-ms") {
      throw new Error("Missing value for --initialize-timeout-ms");
    }
    if (current === "--max-inflight" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--max-inflight must be a positive integer");
      }
      options.maxInflight = parsed;
      index += 1;
      continue;
    }
    if (current === "--max-inflight") throw new Error("Missing value for --max-inflight");
    if (current === "--max-queue" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("--max-queue must be a non-negative integer");
      }
      options.maxQueue = parsed;
      index += 1;
      continue;
    }
    if (current === "--max-queue") throw new Error("Missing value for --max-queue");
    if (current === "--port" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error("--port must be an integer between 1 and 65535");
      }
      options.port = parsed;
      options.transport = "http";
      index += 1;
      continue;
    }
    if (current === "--port") throw new Error("Missing value for --port");
    if (current === "--host" && next) {
      options.host = next;
      options.transport = "http";
      index += 1;
      continue;
    }
    if (current === "--host") throw new Error("Missing value for --host");
    if (current === "--auth-token" && next) {
      options.authToken = next;
      options.transport = "http";
      index += 1;
      continue;
    }
    if (current === "--auth-token") throw new Error("Missing value for --auth-token");
    if (current === "--http-path" && next) {
      options.httpPath = next.startsWith("/") ? next : `/${next}`;
      options.transport = "http";
      index += 1;
      continue;
    }
    if (current === "--http-path") throw new Error("Missing value for --http-path");
    if (current === "--http-mode" && next) {
      if (next !== "stateless" && next !== "stateful") {
        throw new Error("--http-mode must be stateless or stateful");
      }
      options.httpMode = next;
      options.transport = "http";
      index += 1;
      continue;
    }
    if (current === "--http-mode") throw new Error("Missing value for --http-mode");
    if (current === "--diag-json") {
      options.diagJson = true;
      continue;
    }
    if (current.startsWith("-")) throw new Error(`Unknown mcp option: ${current}`);
    throw new Error(`Unexpected mcp argument: ${current}`);
  }

  return options;
}
