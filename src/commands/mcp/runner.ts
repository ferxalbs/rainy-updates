import type { McpOptions } from "../../types/index.js";
import { RainyMcpServer } from "../../mcp/server.js";
import { runStdioTransport } from "../../mcp/transports/stdio.js";
import { runHttpTransport } from "../../mcp/transports/http.js";
import { runSdkMcp } from "../../mcp/sdk-engine.js";
import { readEnv, writeStderr } from "../../utils/runtime.js";

export async function runMcp(options: McpOptions): Promise<void> {
  const engine = (readEnv("RAINY_MCP_ENGINE") ?? "legacy").toLowerCase();
  if (engine === "sdk") {
    try {
      await runSdkMcp(options);
      return;
    } catch (error) {
      if (readEnv("RAINY_MCP_ENGINE_FALLBACK") === "0") throw error;
      writeStderr(
        `rup-mcp: sdk engine failed, falling back to legacy engine. error=${String(error)}\n`,
      );
    }
  }
  const server = new RainyMcpServer(options);
  if (options.transport === "http") {
    await runHttpTransport(server, options);
    return;
  }
  await runStdioTransport(server);
}
