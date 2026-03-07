import { RainyMcpServer } from "../server.js";
import { ContentLengthMessageParser, encodeMessage } from "../protocol.js";

export async function runStdioTransport(server: RainyMcpServer): Promise<void> {
  const parser = new ContentLengthMessageParser();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", async (chunk: string) => {
    const messages = parser.push(chunk);
    for (const message of messages) {
      const response = await server.handleMessage(message as never);
      if (!response) continue;
      process.stdout.write(encodeMessage(response));
    }
  });

  process.stdin.resume();
  await new Promise<void>((resolve) => {
    process.stdin.on("end", () => resolve());
  });
}
