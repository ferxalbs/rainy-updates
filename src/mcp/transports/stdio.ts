import { RainyMcpServer } from "../server.js";
import { NdjsonMessageParser, encodeMessage } from "../protocol.js";

export async function runStdioTransport(server: RainyMcpServer): Promise<void> {
  const parser = new NdjsonMessageParser();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", async (chunk: string) => {
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

      const response = await server.handleMessage(parsedMessage as never);
      if (!response) continue;
      process.stdout.write(encodeMessage(response));
    }
  });

  process.stdin.resume();
  await new Promise<void>((resolve) => {
    process.stdin.on("end", () => resolve());
  });
}
