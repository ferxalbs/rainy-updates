# MCP Quickstart (Users)

This guide is the fastest way to run Rainy Updates as an MCP server in Claude, Cursor, and similar clients.

## 1) Install globally

Choose one command:

```bash
bun add -g @rainy-updates/cli
```

```bash
npm i -g @rainy-updates/cli
```

```bash
pnpm add -g @rainy-updates/cli
```

Verify:

```bash
rup --version
rup mcp --help
```

## 2) Add MCP JSON config

Use this default entry:

```json
{
  "mcpServers": {
    "rainy-updates": {
      "command": "rup",
      "args": ["mcp"],
      "env": {
        "FORCE_COLOR": "0",
        "RUP_DEFAULT_CWD": "/Users/<you>/your-repo"
      }
    }
  }
}
```

Or generate it directly:

```bash
rup mcp --print-config --client claude
rup mcp --print-config --client cursor
rup mcp --print-config --client generic
```

If your app cannot find `rup`, use an absolute path:

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

## 3) Optional settings

SDK migration path:

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

HTTP mode:

```bash
rup mcp --transport http --host 127.0.0.1 --port 3741 --http-path /mcp --auth-token local-dev-token
```

## 4) Smoke test prompts

- `Run rup_context first and show effective cwd`
- `Run rup_doctor for this workspace`
- `List risky updates with rup_review`
- `Check critical vulnerabilities with rup_audit`
- `Explain update risk for react with rup_predict`

## 5) Troubleshooting

- `command not found`: use absolute command path in MCP JSON.
- No response: run `rup mcp --help` and ensure version prints.
- Slow responses: start with narrower scope (`filter`, `severity`, `workspace=false`).
- Debug logs: run with `--diag-json` and inspect stderr in your MCP client logs.
