import type { McpOptions } from "../../types/index.js";
import { RainyMcpServer } from "../../mcp/server.js";
import { runStdioTransport } from "../../mcp/transports/stdio.js";
import { runSseTransport } from "../../mcp/transports/sse.js";

export async function runMcp(options: McpOptions): Promise<void> {
  const server = new RainyMcpServer(options);
  if (options.transport === "sse") {
    await runSseTransport(server, options);
    return;
  }
  await runStdioTransport(server);
}
