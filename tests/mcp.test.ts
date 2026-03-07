import { expect, test } from "bun:test";
import { RainyMcpServer } from "../src/mcp/server.js";

const server = new RainyMcpServer({
  cwd: process.cwd(),
  workspace: false,
  logLevel: "error",
  transport: "stdio",
  toolTimeoutMs: 30_000,
});

test("mcp initialize returns server capabilities", async () => {
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
  });

  expect(response?.result).toBeDefined();
  expect((response?.result as { capabilities?: object }).capabilities).toBeDefined();
});

test("mcp lists tools", async () => {
  const response = await server.handleMessage({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  const tools = (response?.result as { tools: Array<{ name: string }> }).tools;
  expect(tools.some((tool) => tool.name === "rup_check")).toBe(true);
  expect(tools.some((tool) => tool.name === "rup_upgrade")).toBe(true);
  expect(tools.some((tool) => tool.name === "rup_explain")).toBe(true);
});

test("mcp rejects mutating upgrade without confirmation", async () => {
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
