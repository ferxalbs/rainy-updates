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
    const server = new RainyMcpServer(options);
    const handler = createHttpMcpHandler(server, options);
    await handler(
      new Request("http://127.0.0.1:3741/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer secret",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2025-06-18" },
        }),
      }),
    );
    await handler(
      new Request("http://127.0.0.1:3741/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer secret",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      }),
    );

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

  test("returns 202 for notifications", async () => {
    const options = createServerOptions();
    const handler = createHttpMcpHandler(new RainyMcpServer(options), options);
    const response = await handler(
      new Request("http://127.0.0.1:3741/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer secret",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        }),
      }),
    );

    expect(response.status).toBe(202);
  });

  test("returns 415 for non-json content type", async () => {
    const options = createServerOptions();
    const handler = createHttpMcpHandler(new RainyMcpServer(options), options);
    const response = await handler(
      new Request("http://127.0.0.1:3741/mcp", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          authorization: "Bearer secret",
        },
        body: "ping",
      }),
    );

    expect(response.status).toBe(415);
  });
});
