import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  PingRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CLI_VERSION } from "../generated/version.js";
import type { McpOptions } from "../types/index.js";
import { readEnv, writeStderr } from "../utils/runtime.js";
import { emitMcpDiagnostic } from "./diagnostics.js";
import { toMcpErrorShape } from "./errors.js";
import { McpRequestScheduler } from "./scheduler.js";
import { createMcpToolRegistry } from "./tools.js";

export async function runSdkMcp(options: McpOptions): Promise<void> {
  if (options.transport === "http") {
    await runSdkHttpTransport(options);
    return;
  }
  await runSdkStdioTransport(options);
}

type SdkRuntime = {
  initialized: boolean;
  scheduler: McpRequestScheduler;
};

function createSdkServer(options: McpOptions): {
  server: Server;
  runtime: SdkRuntime;
} {
  const registry = createMcpToolRegistry(options);
  const runtime: SdkRuntime = {
    initialized: false,
    scheduler: new McpRequestScheduler(
      options.maxInflight ?? 4,
      options.maxQueue ?? 64,
    ),
  };
  const server = new Server(
    {
      name: "@rainy-updates/cli",
      version: CLI_VERSION,
    },
    {
      capabilities: {
        tools: { listChanged: false },
      },
      enforceStrictCapabilities: false,
    },
  );

  server.oninitialized = () => {
    runtime.initialized = true;
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    assertInitialized(runtime, options);
    return {
      tools: registry.list(),
    };
  });

  (server as unknown as {
    setRequestHandler: (schema: unknown, handler: (request: any) => Promise<any>) => void;
  }).setRequestHandler(CallToolRequestSchema, async (request: any) => {
    assertInitialized(runtime, options);
    const params = request.params ?? {};
    const name = params.name;
    const args = (params.arguments as Record<string, unknown> | undefined) ?? {};

    emitMcpDiagnostic(options, "request.start", {
      method: "tools/call",
      toolName: name,
      ...runtime.scheduler.getState(),
    });

    const startedAt = Date.now();
    return runtime.scheduler.run(async () => {
      try {
        const result = await registry.call(name, args);
        emitMcpDiagnostic(options, "request.end", {
          method: "tools/call",
          toolName: name,
          durationMs: Date.now() - startedAt,
          ok: true,
          ...runtime.scheduler.getState(),
        });
        return result;
      } catch (error) {
        const shape = toMcpErrorShape(error);
        emitMcpDiagnostic(options, "request.error", {
          method: "tools/call",
          toolName: name,
          durationMs: Date.now() - startedAt,
          errorCode: -32000,
          errorMessage: shape.message,
        });
        throw McpError.fromError(-32000, shape.message, shape);
      }
    });
  });

  server.setRequestHandler(PingRequestSchema, async () => ({ ok: true }));

  return { server, runtime };
}

async function runSdkStdioTransport(options: McpOptions): Promise<void> {
  const { server } = createSdkServer(options);
  const transport = new StdioServerTransport();
  transport.onerror = (error) => {
    emitMcpDiagnostic(options, "transport.error", {
      transport: "stdio",
      message: String(error),
    });
  };
  await server.connect(transport);
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
}

async function runSdkHttpTransport(options: McpOptions): Promise<void> {
  const { server, runtime } = createSdkServer(options);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 3741;
  const endpointPath = normalizeEndpointPath(options.httpPath);
  const authToken = options.authToken ?? readEnv("RAINY_MCP_AUTH_TOKEN");
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator:
      options.httpMode === "stateful" ? () => crypto.randomUUID() : undefined,
    enableJsonResponse: true,
  });
  transport.onerror = (error) => {
    emitMcpDiagnostic(options, "transport.error", {
      transport: "http",
      message: String(error),
    });
  };

  await server.connect(transport);

  Bun.serve({
    hostname: host,
    port,
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/health" && request.method === "GET") {
        return Response.json({
          ok: true,
          name: "@rainy-updates/cli",
          version: CLI_VERSION,
          transport: "http",
          endpointPath,
          httpMode: options.httpMode ?? "stateless",
          runtime: {
            initialized: runtime.initialized,
            ...runtime.scheduler.getState(),
          },
        });
      }

      if (url.pathname !== endpointPath) {
        return new Response("Not found", { status: 404 });
      }
      if (
        authToken &&
        request.headers.get("authorization") !== `Bearer ${authToken}`
      ) {
        return new Response("Unauthorized", { status: 401 });
      }

      return transport.handleRequest(request);
    },
  });

  writeStderr(
    `rup-mcp sdk/http listening on http://${host}:${port}${endpointPath}\n`,
  );
  await new Promise(() => {});
}

function assertInitialized(runtime: SdkRuntime, options: McpOptions): void {
  if (runtime.initialized) return;
  throw McpError.fromError(-32002, "Server not initialized", {
    code: "NOT_INITIALIZED",
    expectedFlow: [
      "initialize",
      "notifications/initialized",
      "tools/list|tools/call",
    ],
    initializeTimeoutMs: options.initializeTimeoutMs ?? 10_000,
  });
}

function normalizeEndpointPath(value: string | undefined): string {
  if (!value || value.trim().length === 0) return "/mcp";
  if (value.startsWith("/")) return value;
  return `/${value}`;
}
