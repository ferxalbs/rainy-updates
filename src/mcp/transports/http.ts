import { CLI_VERSION } from "../../generated/version.js";
import { readEnv } from "../../utils/runtime.js";
import type { McpOptions } from "../../types/index.js";
import type { JsonRpcRequest, JsonRpcRequestBatch } from "../protocol.js";
import { RainyMcpServer } from "../server.js";

export function createHttpMcpHandler(server: RainyMcpServer, options: McpOptions) {
  const authToken = options.authToken ?? readEnv("RAINY_MCP_AUTH_TOKEN");
  const endpointPath = normalizeEndpointPath(options.httpPath);

  return async function handleHttpMcpRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        ok: true,
        name: "@rainy-updates/cli",
        version: CLI_VERSION,
        transport: "http",
        endpointPath,
        httpMode: options.httpMode ?? "stateless",
        runtime: server.getRuntimeState(),
      });
    }

    if (url.pathname !== endpointPath) {
      return new Response("Not found", { status: 404 });
    }

    if (authToken && request.headers.get("authorization") !== `Bearer ${authToken}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "POST, GET" },
      });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return new Response("Unsupported media type", { status: 415 });
    }

    let payload: JsonRpcRequest | JsonRpcRequestBatch;
    try {
      payload = (await request.json()) as JsonRpcRequest | JsonRpcRequestBatch;
    } catch {
      return Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
          },
        },
        { status: 400 },
      );
    }

    const response = await server.handlePayload(payload);
    if (!response) {
      return new Response(null, { status: 202 });
    }
    return Response.json(response);
  };
}

export async function runHttpTransport(
  server: RainyMcpServer,
  options: McpOptions,
): Promise<void> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3741;
  const fetch = createHttpMcpHandler(server, options);

  Bun.serve({
    hostname: host,
    port,
    fetch,
  });

  await new Promise(() => {});
}

function normalizeEndpointPath(value: string | undefined): string {
  if (!value || value.trim().length === 0) return "/mcp";
  if (value.startsWith("/")) return value;
  return `/${value}`;
}
