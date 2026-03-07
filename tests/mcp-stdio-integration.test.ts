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
