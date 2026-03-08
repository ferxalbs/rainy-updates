import { stableStringify } from "../../utils/stable-json.js";
import type { McpOptions } from "../../types/index.js";

type McpConfigClient = NonNullable<McpOptions["configClient"]>;

export function renderMcpConfigTemplate(
  options: Pick<McpOptions, "configClient">,
): string {
  const client = options.configClient ?? "generic";
  const base = {
    mcpServers: {
      "rainy-updates": {
        command: "rup",
        args: ["mcp"],
      },
    },
  } as {
    mcpServers: {
      "rainy-updates": {
        command: string;
        args: string[];
        env?: Record<string, string>;
      };
    };
  };

  if (client === "claude") {
    base.mcpServers["rainy-updates"].env = { FORCE_COLOR: "0" };
  }
  if (client === "cursor") {
    base.mcpServers["rainy-updates"].env = { FORCE_COLOR: "0" };
  }

  return stableStringify(base, 2);
}

export function normalizeMcpConfigClient(
  value: string | undefined,
): McpConfigClient {
  if (!value) return "generic";
  if (value === "claude" || value === "cursor" || value === "generic") {
    return value;
  }
  throw new Error("--client must be claude, cursor, or generic");
}
