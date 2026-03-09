# MCP Overview

Rainy Updates can expose its dependency analysis as a local MCP server.

## What it gives an agent

Agents can call local tools such as:

- `rup_check`
- `rup_doctor`
- `rup_predict`
- `rup_review`
- `rup_audit`
- `rup_upgrade`
- `rup_health`
- `rup_bisect`
- `rup_resolve`
- `rup_baseline`
- `rup_explain`
- `rup_badge`
- `rup_supply_chain`
- `rup_attest`

These tools map to the same dependency analysis used by the CLI. The model does the reasoning; Rainy provides deterministic local data.

## Default transport

The default transport is `stdio`:

```bash
rup-mcp
```

This is the recommended mode for Claude Desktop, Cursor, Antigravity, and similar local agent integrations.

`rup mcp` still works as a compatibility alias, but `rup-mcp` is the preferred production entrypoint.

## Optional HTTP transport

If your client prefers HTTP connectivity, Rainy can expose an MCP endpoint:

```bash
rup-mcp --transport http --port 3741 --http-path /mcp
```

You can also provide a bind host and auth token:

```bash
rup-mcp --transport http --host 127.0.0.1 --port 3741 --http-path /mcp --auth-token local-dev-token
```

Reliability and diagnostics controls:

```bash
rup-mcp \
  --transport http \
  --port 3741 \
  --max-inflight 4 \
  --max-queue 64 \
  --tool-timeout-ms 30000 \
  --initialize-timeout-ms 10000 \
  --diag-json
```

## Engine selection (phased SDK migration)

Rainy ships dual MCP engines during migration:

- `RAINY_MCP_ENGINE=legacy` (default) uses the existing production implementation.
- `RAINY_MCP_ENGINE=sdk` enables the official `@modelcontextprotocol/sdk` path.
- `RAINY_MCP_ENGINE_FALLBACK=0` disables fallback to legacy when SDK mode errors.

By default, Rainy does **not** expose an HTTP listener unless you opt in with `--transport http` or `--port`.

## Naming: baseline vs snapshot

Rainy has two separate concepts:

- `baseline`: compare dependency manifest drift over time
- `snapshot`: save and restore a broader dependency state

The MCP tool is named `rup_baseline` because it maps to the existing `baseline` CLI command. It does **not** map to `snapshot`.

## Related docs

- [Claude Desktop setup](./mcp-claude-desktop.md)
- [Cursor setup](./mcp-cursor.md)
- [Security model](./mcp-security-model.md)
- [Tool reference and stability contract](./mcp-tools.md)
