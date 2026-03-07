# Cursor Setup

Cursor can connect to Rainy Updates through MCP using the local `rup-mcp` command.

## stdio configuration

Example `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "rup",
      "args": ["mcp"]
    }
  }
}
```

Preferred dedicated binary:

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "rup-mcp"
    }
  }
}
```

## Optional SSE configuration

Start Rainy in SSE mode:

```bash
rup-mcp --transport sse --port 3741 --auth-token local-dev-token
```

Then configure Cursor to connect to the local endpoint if your setup prefers HTTP/SSE over stdio.

## Recommended workflows

- Ask Cursor to run `rup_doctor` before changing dependency ranges.
- Use `rup_review` to generate a decision queue before applying updates.
- Use `rup_explain` when you want a package-level summary instead of a full workspace review.
