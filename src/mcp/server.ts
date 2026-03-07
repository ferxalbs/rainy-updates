import { CLI_VERSION } from "../generated/version.js";
import type { McpOptions } from "../types/index.js";
import type { JsonRpcRequest, JsonRpcResponse } from "./protocol.js";
import { callMcpTool, listMcpTools } from "./tools.js";
import { toMcpErrorShape } from "./errors.js";

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
  constructor(private readonly options: McpOptions) {}

  async handleMessage(message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    if (
      (message.id === undefined || message.id === null) &&
      message.method === "notifications/initialized"
    ) {
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

        return {
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
      }

      if (message.method === "tools/list") {
        return {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result: {
            tools: listMcpTools(this.options),
          },
        };
      }

      if (message.method === "tools/call") {
        const params = message.params ?? {};
        const name = params.name;
        const args = params.arguments;
        if (typeof name !== "string") {
          throw new Error("tools/call requires params.name");
        }
        const result = await callMcpTool(
          this.options,
          name,
          (args as Record<string, unknown> | undefined) ?? {},
        );
        return {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result,
        };
      }

      if (message.method === "ping") {
        return {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result: { ok: true },
        };
      }

      if (message.method === "shutdown") {
        return {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result: { ok: true },
        };
      }

      return {
        jsonrpc: "2.0",
        id: message.id ?? null,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`,
        },
      };
    } catch (error) {
      if (error instanceof JsonRpcError) {
        return {
          jsonrpc: "2.0",
          id: message.id ?? null,
          error: {
            code: error.code,
            message: error.message,
            data: error.data,
          },
        };
      }

      const shape = toMcpErrorShape(error);
      return {
        jsonrpc: "2.0",
        id: message.id ?? null,
        error: {
          code: -32000,
          message: shape.message,
          data: shape,
        },
      };
    }
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
