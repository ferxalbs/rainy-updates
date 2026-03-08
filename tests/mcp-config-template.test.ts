import { expect, test } from "bun:test";
import {
  normalizeMcpConfigClient,
  renderMcpConfigTemplate,
} from "../src/commands/mcp/config-template.js";

test("renderMcpConfigTemplate renders claude profile with FORCE_COLOR env", () => {
  const output = renderMcpConfigTemplate({ configClient: "claude" });
  const parsed = JSON.parse(output) as {
    mcpServers: {
      "rainy-updates": {
        command: string;
        args: string[];
        env?: Record<string, string>;
      };
    };
  };
  expect(parsed.mcpServers["rainy-updates"].command).toBe("rup");
  expect(parsed.mcpServers["rainy-updates"].args).toEqual(["mcp"]);
  expect(parsed.mcpServers["rainy-updates"].env?.FORCE_COLOR).toBe("0");
});

test("normalizeMcpConfigClient validates client value", () => {
  expect(normalizeMcpConfigClient("cursor")).toBe("cursor");
  expect(() => normalizeMcpConfigClient("vscode")).toThrow(
    "--client must be claude, cursor, or generic",
  );
});
