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

## SSE configuration

If you prefer SSE instead of stdio:

```bash
rup-mcp --transport sse --port 3741 --auth-token local-dev-token
```

Then point Claude Desktop at the local endpoint using your MCP client’s HTTP/SSE settings.

## Good first prompts

- `Run a dependency health check for this workspace.`
- `Review which updates are high risk and why.`
- `Explain whether upgrading lodash is safe right now.`
- `Scan for critical advisories and summarize the fix path.`
