export interface McpToolErrorShape {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export class McpToolError extends Error {
  shape: McpToolErrorShape;

  constructor(shape: McpToolErrorShape) {
    super(shape.message);
    this.name = "McpToolError";
    this.shape = shape;
  }
}

export function toMcpErrorShape(error: unknown): McpToolErrorShape {
  if (error instanceof McpToolError) {
    return error.shape;
  }
  return {
    code: "INTERNAL_ERROR",
    message: String(error),
    retryable: false,
  };
}
