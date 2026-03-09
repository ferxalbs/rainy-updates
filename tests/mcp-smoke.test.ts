import { expect, test } from "bun:test";
import { RainyMcpServer } from "../src/mcp/server.js";

async function createInitializedServer(): Promise<RainyMcpServer> {
  const server = new RainyMcpServer({
    cwd: process.cwd(),
    workspace: false,
    logLevel: "error",
    transport: "stdio",
    toolTimeoutMs: 1_000,
  });

  await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18" },
  });
  await server.handleMessage({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  return server;
}

test("mcp smoke: read-only tools accept baseline payloads without INVALID_PARAMS", async () => {
  const server = await createInitializedServer();

  const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [
    { name: "rup_context", arguments: {} },
    { name: "rup_check", arguments: {} },
    { name: "rup_doctor", arguments: {} },
    { name: "rup_predict", arguments: { workspace: true } },
    { name: "rup_review", arguments: {} },
    { name: "rup_audit", arguments: { severity: "HIGH" } },
    { name: "rup_health", arguments: {} },
    { name: "rup_resolve", arguments: {} },
    { name: "rup_baseline", arguments: {} },
    { name: "rup_explain", arguments: { packageName: "zod" } },
    { name: "rup_badge", arguments: { action: "url" } },
    { name: "rup_supply_chain", arguments: {} },
    { name: "rup_attest", arguments: {} },
  ];

  for (const entry of toolCalls) {
    const response = await server.handleMessage({
      jsonrpc: "2.0",
      id: `${entry.name}-smoke`,
      method: "tools/call",
      params: {
        name: entry.name,
        arguments: entry.arguments,
      },
    });

    const errorCode = (response?.error?.data as { code?: string } | undefined)?.code;
    expect(errorCode).not.toBe("INVALID_PARAMS");
  }
}, 25_000);
