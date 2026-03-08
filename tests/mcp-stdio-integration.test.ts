import { expect, test } from "bun:test";

test("rup-mcp accepts ndjson over stdio", async () => {
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
    },
  });

  const output = await Bun.$`printf '${request}\n' | bun run ./src/bin/mcp.ts`.text();
  const firstLine = output.split("\n").find((line) => line.trim().length > 0);
  expect(firstLine).toBeDefined();
  const parsed = JSON.parse(firstLine ?? "{}") as {
    jsonrpc: string;
    id: number;
    result?: { protocolVersion?: string };
  };

  expect(parsed.jsonrpc).toBe("2.0");
  expect(parsed.id).toBe(1);
  expect(parsed.result?.protocolVersion).toBe("2025-03-26");
});

test("rup-mcp sdk engine handles initialize and tools/list", async () => {
  const init = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });
  const initialized = JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
  const list = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });

  const output = await Bun.$`printf '${init}\n${initialized}\n${list}\n' | RAINY_MCP_ENGINE=sdk bun run ./src/bin/mcp.ts`.text();
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const listLine = lines.find((line) => line.includes("\"id\":2"));
  expect(listLine).toBeDefined();
  const payload = JSON.parse(listLine ?? "{}") as {
    result?: { tools?: Array<{ name: string }> };
  };
  expect(payload.result?.tools?.some((tool) => tool.name === "rup_check")).toBe(true);
});
