import { describe, expect, test } from "bun:test";
import { NdjsonMessageParser, encodeMessage } from "../src/mcp/protocol.js";

describe("mcp protocol ndjson", () => {
  test("encodeMessage serializes JSON-RPC with trailing newline", () => {
    const encoded = encodeMessage({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    expect(encoded.endsWith("\n")).toBe(true);
    expect(encoded).toContain("\"jsonrpc\":\"2.0\"");
  });

  test("parser returns complete lines and ignores blanks", () => {
    const parser = new NdjsonMessageParser();
    const first = parser.push("\n{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}\n");
    const second = parser.push("{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"ping\"}");
    const third = parser.push("\n");

    expect(first).toEqual(['{"jsonrpc":"2.0","id":1,"method":"ping"}']);
    expect(second).toEqual([]);
    expect(third).toEqual(['{"jsonrpc":"2.0","id":2,"method":"ping"}']);
  });
});
