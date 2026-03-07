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

If Cursor does not inherit your shell `PATH`, use the absolute command path:

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "/Users/<you>/.bun/bin/rup-mcp"
    }
  }
}
```

## Optional HTTP configuration

Start Rainy in HTTP mode:

```bash
rup-mcp --transport http --port 3741 --http-path /mcp --auth-token local-dev-token
```

Then configure Cursor to connect to `http://127.0.0.1:3741/mcp` if your setup prefers HTTP over stdio.

## Recommended workflows

- Ask Cursor to run `rup_doctor` before changing dependency ranges.
- Use `rup_review` to generate a decision queue before applying updates.
- Use `rup_explain` when you want a package-level summary instead of a full workspace review.
