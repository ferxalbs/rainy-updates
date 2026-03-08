# Claude Desktop Setup

Use Rainy Updates with Claude Desktop by registering `rup` (or `rup-mcp`) as a local MCP server.

## Recommended config (stdio)

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

## Optional SDK engine mode

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "rup",
      "args": ["mcp"],
      "env": {
        "FORCE_COLOR": "0",
        "RAINY_MCP_ENGINE": "sdk"
      }
    }
  }
}
```

## If PATH is not inherited

Use absolute command path by runtime/environment:

- Bun global (macOS/Linux): `/Users/<you>/.bun/bin/rup`
- npm global (macOS/Linux): output of `npm bin -g` + `/rup`
- pnpm global (macOS/Linux): output of `pnpm bin -g` + `/rup`
- Windows Bun global: `C:\\Users\\<you>\\.bun\\bin\\rup.exe`

Example:

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "/Users/<you>/.bun/bin/rup",
      "args": ["mcp"],
      "env": {
        "FORCE_COLOR": "0"
      }
    }
  }
}
```

## Optional HTTP mode

Start server:

```bash
rup mcp --transport http --host 127.0.0.1 --port 3741 --http-path /mcp --auth-token local-dev-token
```

Then configure Claude to connect to `http://127.0.0.1:3741/mcp` if your client supports HTTP transport.

## First prompts

- `Run rup_doctor for this workspace`
- `Show high-risk updates with rup_review`
- `Check critical vulnerabilities with rup_audit`
- `Predict break risk for react with rup_predict`
