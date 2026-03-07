import { expect, test } from "bun:test";
import { parseMcpArgs } from "../src/commands/mcp/parser.js";

test("parseMcpArgs maps network flags to http transport", () => {
  const parsed = parseMcpArgs([
    "--port",
    "3741",
    "--host",
    "127.0.0.1",
    "--auth-token",
    "secret",
    "--http-path",
    "mcp",
  ]);

  expect(parsed.transport).toBe("http");
  expect(parsed.port).toBe(3741);
  expect(parsed.host).toBe("127.0.0.1");
  expect(parsed.authToken).toBe("secret");
  expect(parsed.httpPath).toBe("/mcp");
});

test("parseMcpArgs rejects removed sse transport", () => {
  expect(() => parseMcpArgs(["--transport", "sse"])).toThrow(
    "--transport must be stdio or http",
  );
});
