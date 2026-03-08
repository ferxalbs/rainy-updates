# Cursor Setup

Cursor can connect to Rainy Updates through MCP using local `rup mcp`.

## Recommended config (stdio)

Example `.cursor/mcp.json`:

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
        "RAINY_MCP_ENGINE": "sdk"
      }
    }
  }
}
```

## If PATH is not inherited

Use absolute command path:

- Bun global (macOS/Linux): `/Users/<you>/.bun/bin/rup`
- npm/pnpm global: use `npm bin -g` or `pnpm bin -g`, then append `/rup`
- Windows Bun global: `C:\\Users\\<you>\\.bun\\bin\\rup.exe`

Example:

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "/Users/<you>/.bun/bin/rup",
      "args": ["mcp"]
    }
  }
}
```

## Optional HTTP mode

Start server:

```bash
rup mcp --transport http --host 127.0.0.1 --port 3741 --http-path /mcp --auth-token local-dev-token
```

Then configure Cursor to connect to `http://127.0.0.1:3741/mcp` if your setup prefers HTTP over stdio.

## Recommended workflows

- Ask Cursor to run `rup_doctor` before changing dependency ranges.
- Use `rup_review` to generate a decision queue before applying updates.
- Use `rup_explain` when you want a package-level summary instead of a full workspace review.
