import { CLI_VERSION } from "../generated/version.js";
import type { McpOptions } from "../types/index.js";
import type { JsonRpcRequest, JsonRpcResponse, JsonRpcRequestBatch } from "./protocol.js";
import { createMcpToolRegistry, type McpToolRegistry } from "./tools.js";
import { toMcpErrorShape } from "./errors.js";
import { McpRequestScheduler } from "./scheduler.js";
import { emitMcpDiagnostic } from "./diagnostics.js";

const SUPPORTED_PROTOCOL_VERSIONS = [
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
] as const;
const DEFAULT_PROTOCOL_VERSION = "2025-03-26";

class JsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }
}

export class RainyMcpServer {
  private readonly tools: McpToolRegistry;
  private readonly scheduler: McpRequestScheduler;
  private initialized = false;
  private shutdownRequested = false;

  constructor(private readonly options: McpOptions) {
    this.tools = createMcpToolRegistry(options);
    this.scheduler = new McpRequestScheduler(
      options.maxInflight ?? 4,
      options.maxQueue ?? 64,
    );
  }

  async handlePayload(
    payload: JsonRpcRequest | JsonRpcRequestBatch,
  ): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Invalid Request" },
        };
      }

      const responses: JsonRpcResponse[] = [];
      for (const message of payload) {
        const response = await this.handleMessage(message);
        if (response) responses.push(response);
      }
      return responses.length > 0 ? responses : null;
    }

    return this.handleMessage(payload);
  }

  async handleMessage(message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    const startedAt = Date.now();
    emitMcpDiagnostic(this.options, "request.start", {
      method: message.method,
      id: message.id ?? null,
      ...this.scheduler.getState(),
    });

    if (
      (message.id === undefined || message.id === null) &&
      message.method === "notifications/initialized"
    ) {
      this.initialized = true;
      return null;
    }

    try {
      if (message.method === "initialize") {
        const requestedVersion =
          typeof message.params?.protocolVersion === "string"
            ? message.params.protocolVersion
            : DEFAULT_PROTOCOL_VERSION;
        const negotiatedVersion = negotiateProtocolVersion(requestedVersion);
        if (!negotiatedVersion) {
          throw new JsonRpcError(-32602, "Unsupported protocol version", {
            supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
            requestedProtocolVersion: requestedVersion,
          });
        }
        this.shutdownRequested = false;

        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result: {
            protocolVersion: negotiatedVersion,
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: {
              name: "@rainy-updates/cli",
              version: CLI_VERSION,
            },
          },
        };
        emitMcpDiagnostic(this.options, "request.end", {
          method: message.method,
          id: message.id ?? null,
          durationMs: Date.now() - startedAt,
          ok: true,
        });
        return response;
      }

      if (
        !this.initialized &&
        (message.method === "tools/list" || message.method === "tools/call")
      ) {
        throw new JsonRpcError(-32002, "Server not initialized", {
          expectedFlow: ["initialize", "notifications/initialized", "tools/list|tools/call"],
          initializeTimeoutMs: this.options.initializeTimeoutMs ?? 10_000,
        });
      }

      if (this.shutdownRequested && message.method !== "ping") {
        throw new JsonRpcError(-32001, "Server is shutting down");
      }

      if (message.method === "tools/list") {
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result: {
            tools: this.tools.list(),
          },
        };
        emitMcpDiagnostic(this.options, "request.end", {
          method: message.method,
          id: message.id ?? null,
          durationMs: Date.now() - startedAt,
          ok: true,
        });
        return response;
      }

      if (message.method === "tools/call") {
        const params = message.params ?? {};
        const name = params.name;
        const args = params.arguments;
        if (typeof name !== "string") {
          throw new Error("tools/call requires params.name");
        }
        const result = await this.scheduler.run(() =>
          this.tools.call(
            name,
            (args as Record<string, unknown> | undefined) ?? {},
          )
        );
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result,
        };
        emitMcpDiagnostic(this.options, "request.end", {
          method: message.method,
          id: message.id ?? null,
          durationMs: Date.now() - startedAt,
          ok: true,
          ...this.scheduler.getState(),
        });
        return response;
      }

      if (message.method === "ping") {
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result: { ok: true },
        };
        emitMcpDiagnostic(this.options, "request.end", {
          method: message.method,
          id: message.id ?? null,
          durationMs: Date.now() - startedAt,
          ok: true,
        });
        return response;
      }

      if (message.method === "shutdown") {
        this.shutdownRequested = true;
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result: { ok: true },
        };
        emitMcpDiagnostic(this.options, "request.end", {
          method: message.method,
          id: message.id ?? null,
          durationMs: Date.now() - startedAt,
          ok: true,
        });
        return response;
      }

      const response: JsonRpcResponse = {
        jsonrpc: "2.0",
        id: message.id ?? null,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`,
        },
      };
      emitMcpDiagnostic(this.options, "request.error", {
        method: message.method,
        id: message.id ?? null,
        durationMs: Date.now() - startedAt,
        errorCode: -32601,
      });
      return response;
    } catch (error) {
      if (error instanceof JsonRpcError) {
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: message.id ?? null,
          error: {
            code: error.code,
            message: error.message,
            data: error.data,
          },
        };
        emitMcpDiagnostic(this.options, "request.error", {
          method: message.method,
          id: message.id ?? null,
          durationMs: Date.now() - startedAt,
          errorCode: error.code,
          errorMessage: error.message,
        });
        return response;
      }

      const shape = toMcpErrorShape(error);
      const response: JsonRpcResponse = {
        jsonrpc: "2.0",
        id: message.id ?? null,
        error: {
          code: -32000,
          message: shape.message,
          data: shape,
        },
      };
      emitMcpDiagnostic(this.options, "request.error", {
        method: message.method,
        id: message.id ?? null,
        durationMs: Date.now() - startedAt,
        errorCode: -32000,
        errorMessage: shape.message,
      });
      return response;
    }
  }

  getRuntimeState(): {
    initialized: boolean;
    shutdownRequested: boolean;
    inflight: number;
    queued: number;
    maxInflight: number;
    maxQueue: number;
  } {
    return {
      initialized: this.initialized,
      shutdownRequested: this.shutdownRequested,
      ...this.scheduler.getState(),
    };
  }
}

function negotiateProtocolVersion(requestedVersion: string): string | null {
  if (SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion as never)) {
    return requestedVersion;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedVersion)) {
    return null;
  }

  const compatible = [...SUPPORTED_PROTOCOL_VERSIONS]
    .filter((version) => version <= requestedVersion)
    .sort()
    .pop();

  return compatible ?? null;
}
