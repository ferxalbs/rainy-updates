import { RainyMcpServer } from "../server.js";
import { NdjsonMessageParser, encodeMessage } from "../protocol.js";

export async function runStdioTransport(server: RainyMcpServer): Promise<void> {
  const parser = new NdjsonMessageParser();
  process.stdin.setEncoding("utf8");
  let pipeline = Promise.resolve();

  process.stdin.on("data", (chunk: string) => {
    pipeline = pipeline
      .then(() => processChunk(server, parser, chunk))
      .catch((error) => {
        process.stderr.write(`rup-mcp transport error: ${String(error)}\n`);
      });
  });

  process.stdin.resume();
  await new Promise<void>((resolve) => {
    process.stdin.on("end", () => resolve());
  });
  await pipeline;
}

async function processChunk(
  server: RainyMcpServer,
  parser: NdjsonMessageParser,
  chunk: string,
): Promise<void> {
  const messages = parser.push(chunk);
  for (const rawMessage of messages) {
    let parsedMessage: unknown;
    try {
      parsedMessage = JSON.parse(rawMessage);
    } catch {
      process.stdout.write(
        encodeMessage({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
          },
        }),
      );
      continue;
    }

    const response = await server.handlePayload(parsedMessage as never);
    if (!response) continue;
    if (Array.isArray(response)) {
      process.stdout.write(encodeMessage(response));
      continue;
    }
    process.stdout.write(encodeMessage(response));
  }
}
