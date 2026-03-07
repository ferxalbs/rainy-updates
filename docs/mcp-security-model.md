# MCP Security Model

Rainy Updates treats MCP as a **local integration surface**, not as a hosted AI feature.

## Defaults

- Default transport is `stdio`
- No HTTP listener is opened by default
- The CLI does not send code or dependency state to a Rainy cloud service
- Any network calls still come from the existing CLI behaviors, such as registry metadata or advisory lookups

## SSE mode

If you enable `SSE`:

- bind to a local host unless you have a strong reason not to
- use `--auth-token` or `RAINY_MCP_AUTH_TOKEN`
- treat the endpoint as local infrastructure, not a public service

Example:

```bash
rup-mcp --transport sse --host 127.0.0.1 --port 3741 --auth-token local-dev-token
```

## Mutating tools

Read-only tools such as `rup_check`, `rup_doctor`, `rup_review`, `rup_audit`, and `rup_health` are safe by default.

Mutating tools such as `rup_upgrade` require explicit confirmation parameters so an agent cannot apply changes accidentally.

## Baseline vs snapshot

Do not conflate:

- `rup_baseline` / `baseline`: manifest drift detection
- `snapshot`: save/restore dependency state workflows

This distinction matters in agent integrations because the MCP tool surface follows the existing CLI baseline contract.
