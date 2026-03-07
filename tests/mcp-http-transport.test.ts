import { describe, expect, test } from "bun:test";
import { RainyMcpServer } from "../src/mcp/server.js";
import { createHttpMcpHandler } from "../src/mcp/transports/http.js";

function createServerOptions() {
  return {
    cwd: process.cwd(),
    workspace: false,
    logLevel: "error" as const,
    transport: "http" as const,
    toolTimeoutMs: 30_000,
    host: "127.0.0.1",
    port: 3741,
    authToken: "secret",
    httpPath: "/mcp",
  };
}

describe("mcp http transport handler", () => {
  test("returns 401 when auth token is required", async () => {
    const handler = createHttpMcpHandler(
      new RainyMcpServer(createServerOptions()),
      createServerOptions(),
    );
    const response = await handler(
      new Request("http://127.0.0.1:3741/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  test("handles tools/list request over POST", async () => {
    const options = createServerOptions();
    const handler = createHttpMcpHandler(new RainyMcpServer(options), options);
    const response = await handler(
      new Request("http://127.0.0.1:3741/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer secret",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    expect(payload.result.tools.some((tool) => tool.name === "rup_check")).toBe(true);
  });
});
