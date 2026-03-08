import { expect, test } from "bun:test";
import { parseMcpArgs } from "../src/commands/mcp/parser.js";

test("parseMcpArgs maps network flags to http transport", () => {
  const parsed = parseMcpArgs([
    "--max-inflight",
    "8",
    "--max-queue",
    "128",
    "--initialize-timeout-ms",
    "15000",
    "--diag-json",
    "--port",
    "3741",
    "--host",
    "127.0.0.1",
    "--auth-token",
    "secret",
    "--http-path",
    "mcp",
    "--http-mode",
    "stateful",
  ]);

  expect(parsed.transport).toBe("http");
  expect(parsed.port).toBe(3741);
  expect(parsed.host).toBe("127.0.0.1");
  expect(parsed.authToken).toBe("secret");
  expect(parsed.httpPath).toBe("/mcp");
  expect(parsed.maxInflight).toBe(8);
  expect(parsed.maxQueue).toBe(128);
  expect(parsed.initializeTimeoutMs).toBe(15000);
  expect(parsed.diagJson).toBe(true);
  expect(parsed.httpMode).toBe("stateful");
});

test("parseMcpArgs rejects removed sse transport", () => {
  expect(() => parseMcpArgs(["--transport", "sse"])).toThrow(
    "--transport must be stdio or http",
  );
});

test("parseMcpArgs supports print-config with client profile", () => {
  const parsed = parseMcpArgs(["--print-config", "--client", "claude"]);
  expect(parsed.printConfig).toBe(true);
  expect(parsed.configClient).toBe("claude");
});
