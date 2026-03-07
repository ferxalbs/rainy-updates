# Claude Desktop Setup

Use Rainy Updates with Claude Desktop by registering `rup-mcp` as a local MCP server.

## stdio configuration

Add this to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "rup",
      "args": ["mcp"],
      "env": {
        "FORCE_COLOR": "0"
      }
    }
  }
}
```

Preferred dedicated binary:

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "rup-mcp",
      "env": {
        "FORCE_COLOR": "0"
      }
    }
  }
}
```

If Claude Desktop does not inherit your shell `PATH`, use the absolute command path:

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "/Users/<you>/.bun/bin/rup-mcp",
      "env": {
        "FORCE_COLOR": "0"
      }
    }
  }
}
```

## HTTP configuration

If you prefer HTTP instead of stdio:

```bash
rup-mcp --transport http --port 3741 --http-path /mcp --auth-token local-dev-token
```

Then point Claude Desktop at `http://127.0.0.1:3741/mcp` using your MCP client’s HTTP settings.

## Good first prompts

- `Run a dependency health check for this workspace.`
- `Review which updates are high risk and why.`
- `Explain whether upgrading lodash is safe right now.`
- `Scan for critical advisories and summarize the fix path.`
