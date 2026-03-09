import { expect, test } from "bun:test";
import { RainyMcpServer } from "../src/mcp/server.js";

const server = new RainyMcpServer({
  cwd: process.cwd(),
  workspace: false,
  logLevel: "error",
  transport: "stdio",
  toolTimeoutMs: 30_000,
});

async function initializeServerSession(): Promise<void> {
  await server.handleMessage({
    jsonrpc: "2.0",
    id: 999,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
    },
  });
  await server.handleMessage({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
}

test("mcp initialize returns server capabilities", async () => {
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
    },
  });

  expect(response?.result).toBeDefined();
  expect((response?.result as { capabilities?: object }).capabilities).toBeDefined();
});

test("mcp initialize rejects unsupported protocol version", async () => {
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 10,
    method: "initialize",
    params: {
      protocolVersion: "2023-01-01",
    },
  });

  expect(response?.error?.code).toBe(-32602);
  expect(response?.error?.message).toContain("Unsupported protocol version");
});

test("mcp initialize accepts older supported version", async () => {
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 11,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
    },
  });

  const result = response?.result as { protocolVersion?: string };
  expect(result.protocolVersion).toBe("2024-11-05");
});

test("mcp initialize negotiates down from newer requested version", async () => {
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 12,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
    },
  });

  const result = response?.result as { protocolVersion?: string };
  expect(result.protocolVersion).toBe("2025-06-18");
});

test("mcp lists tools", async () => {
  await initializeServerSession();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  const tools = (response?.result as { tools: Array<{ name: string }> }).tools;
  expect(tools.some((tool) => tool.name === "rup_context")).toBe(true);
  expect(tools.some((tool) => tool.name === "rup_check")).toBe(true);
  expect(tools.some((tool) => tool.name === "rup_upgrade")).toBe(true);
  expect(tools.some((tool) => tool.name === "rup_explain")).toBe(true);
});

test("mcp tool catalog remains stable", async () => {
  await initializeServerSession();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 20,
    method: "tools/list",
  });

  const tools = (response?.result as { tools: Array<{ name: string }> }).tools;
  const names = tools.map((tool) => tool.name);
  expect(names).toEqual([
    "rup_context",
    "rup_check",
    "rup_doctor",
    "rup_predict",
    "rup_review",
    "rup_audit",
    "rup_upgrade",
    "rup_health",
    "rup_bisect",
    "rup_resolve",
    "rup_baseline",
    "rup_explain",
  ]);
});

test("mcp rejects mutating upgrade without confirmation", async () => {
  await initializeServerSession();
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "rup_upgrade",
      arguments: {
        fromPlanFile: ".artifacts/missing-plan.json",
        confirm: false,
      },
    },
  });

  expect(response?.error?.data).toBeDefined();
  expect((response?.error?.data as { code?: string }).code).toBe("CONFIRMATION_REQUIRED");
});

test("mcp rejects tools/call before initialize", async () => {
  const uninitialized = new RainyMcpServer({
    cwd: process.cwd(),
    workspace: false,
    logLevel: "error",
    transport: "stdio",
    toolTimeoutMs: 30_000,
  });
  const response = await uninitialized.handleMessage({
    jsonrpc: "2.0",
    id: 41,
    method: "tools/call",
    params: {
      name: "rup_check",
      arguments: {},
    },
  });

  expect(response?.error?.code).toBe(-32002);
});

test("mcp handles batch payloads", async () => {
  const batchServer = new RainyMcpServer({
    cwd: process.cwd(),
    workspace: false,
    logLevel: "error",
    transport: "stdio",
    toolTimeoutMs: 30_000,
  });

  const batch = await batchServer.handlePayload([
    {
      jsonrpc: "2.0",
      id: 51,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    },
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    },
    {
      jsonrpc: "2.0",
      id: 52,
      method: "tools/list",
    },
  ]);

  expect(Array.isArray(batch)).toBe(true);
  const responses = batch as Array<{ id: number | null }>;
  expect(responses.some((item) => item.id === 51)).toBe(true);
  expect(responses.some((item) => item.id === 52)).toBe(true);
});
