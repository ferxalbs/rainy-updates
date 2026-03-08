# MCP Compatibility Guide (Tools + Environments)

Use this guide when your MCP client is not Claude or Cursor, or when you need cross-environment setup.

## Universal stdio template

Most MCP clients support command-based servers.

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

## Universal HTTP template

Start server:

```bash
rup mcp --transport http --host 127.0.0.1 --port 3741 --http-path /mcp --auth-token local-dev-token
```

Client target:

- URL: `http://127.0.0.1:3741/mcp`
- Header: `Authorization: Bearer local-dev-token` (if supported by your client)

## Environment compatibility

### macOS / Linux

- Bun global path: `/Users/<you>/.bun/bin/rup`
- npm global bin: output of `npm bin -g`
- pnpm global bin: output of `pnpm bin -g`

### Windows

- Bun global path: `C:\\Users\\<you>\\.bun\\bin\\rup.exe`
- npm global bin: `npm bin -g` (append `\\rup.cmd` or `\\rup`)
- pnpm global bin: `pnpm bin -g` (append `\\rup.cmd` or `\\rup`)

If command discovery fails, use absolute `command` path in MCP JSON.

## SDK/legacy engine compatibility

Rainy supports phased engines:

- `RAINY_MCP_ENGINE=legacy` (default)
- `RAINY_MCP_ENGINE=sdk` (official SDK path)
- `RAINY_MCP_ENGINE_FALLBACK=0` to disable fallback while validating SDK mode

Example:

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

## Reliability options

For large repos or busy agents:

```bash
rup mcp \
  --max-inflight 4 \
  --max-queue 64 \
  --tool-timeout-ms 30000 \
  --initialize-timeout-ms 10000 \
  --diag-json
```

## Troubleshooting

- `command not found`: use absolute command path.
- handshake errors: ensure your client sends `initialize` before tool calls.
- slow responses: reduce scope (`workspace`, filters, severity).
- repeated timeout: increase `--tool-timeout-ms` or retry with narrower input.

