import { CLI_VERSION } from "../../generated/version.js";
import { readEnv } from "../../utils/runtime.js";
import type { McpOptions } from "../../types/index.js";
import { encodeMessage } from "../protocol.js";
import { RainyMcpServer } from "../server.js";

export async function runSseTransport(
  server: RainyMcpServer,
  options: McpOptions,
): Promise<void> {
  const authToken = options.authToken ?? readEnv("RAINY_MCP_AUTH_TOKEN");
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3741;

  Bun.serve({
    hostname: host,
    port,
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/health") {
        return Response.json({
          ok: true,
          name: "@rainy-updates/cli",
          version: CLI_VERSION,
          transport: "sse",
        });
      }

      if (authToken && request.headers.get("authorization") !== `Bearer ${authToken}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (url.pathname === "/rpc" && request.method === "POST") {
        const message = (await request.json()) as Parameters<RainyMcpServer["handleMessage"]>[0];
        const response = await server.handleMessage(message);
        return Response.json(response ?? { jsonrpc: "2.0", id: null, result: null });
      }

      if (url.pathname === "/sse") {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
          },
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
            "x-rainy-rpc-endpoint": `http://${host}:${port}/rpc`,
            "x-rainy-frame": encodeMessage({ protocol: "mcp-json-rpc" }),
          },
        });
      }

      return new Response("Not found", { status: 404 });
    },
  });

  await new Promise(() => {});
}
