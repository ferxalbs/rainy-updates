export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export function encodeMessage(message: object): string {
  return `${JSON.stringify(message)}\n`;
}

export class NdjsonMessageParser {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines: string[] = [];

    while (true) {
      const lineEnd = this.buffer.indexOf("\n");
      if (lineEnd === -1) break;
      const line = this.buffer.slice(0, lineEnd).trim();
      this.buffer = this.buffer.slice(lineEnd + 1);
      if (line.length === 0) continue;
      lines.push(line);
    }

    return lines;
  }
}
