import { CLI_VERSION } from "../generated/version.js";
import type { McpOptions } from "../types/index.js";
import type { JsonRpcRequest, JsonRpcResponse } from "./protocol.js";
import { callMcpTool, listMcpTools } from "./tools.js";
import { toMcpErrorShape } from "./errors.js";

export class RainyMcpServer {
  constructor(private readonly options: McpOptions) {}

  async handleMessage(message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
    if (!message.id && message.method === "notifications/initialized") {
      return null;
    }

    try {
      if (message.method === "initialize") {
        return {
          jsonrpc: "2.0",
          id: message.id ?? null,
          result: {
            protocolVersion: "2025-03-26",
            capabilities: {
              tools: {},
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
