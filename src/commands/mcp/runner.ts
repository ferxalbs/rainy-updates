import type { McpOptions } from "../../types/index.js";
import { RainyMcpServer } from "../../mcp/server.js";
import { runStdioTransport } from "../../mcp/transports/stdio.js";
import { runHttpTransport } from "../../mcp/transports/http.js";

export async function runMcp(options: McpOptions): Promise<void> {
  const server = new RainyMcpServer(options);
  if (options.transport === "http") {
    await runHttpTransport(server, options);
    return;
  }
  await runStdioTransport(server);
}
