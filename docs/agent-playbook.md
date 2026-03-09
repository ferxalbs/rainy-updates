# Agent Playbook (MCP)

This document is for AI agents and power users working with `@rainy-updates/cli` through MCP.

## Goal

Use Rainy tools in a safe, deterministic workflow:

1. `rup_check` for candidate updates
2. `rup_doctor` for health summary
3. `rup_predict` for break-risk estimation
4. `rup_review` for decision queue
5. `rup_upgrade` only with explicit `confirm=true`

## Stable tool surface

Current stable tools:

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

Prefer `structuredContent` in responses over text parsing.

## Recommended workflows

### Safe default (read-only first)

1. Run `rup_doctor` to get summary and next action.
2. Run `rup_review` with filters (`risk`, `diff`, git scope).
3. Run `rup_predict` to estimate confidence and likely breakage.
4. Run `rup_upgrade` only after decision plan exists and user confirms.

### Security-first triage

1. Run `rup_audit` with `severity=critical|high`.
2. Run `rup_review --securityOnly`.
3. Run `rup_predict` for selected high-impact updates.

### Branch-scoped review

Use git-scope fields when available:

- `affected`
- `staged`
- `baseRef`
- `headRef`
- `sinceRef`

This reduces noise and improves latency.

## Reliability guidance

- Always initialize session before tool calls.
- Use narrower scope on retries after timeout.
- If overloaded, retry with reduced breadth (single package, stricter filters).
- For local integrations, prefer `stdio` unless HTTP is required.

## Mutation policy

`rup_upgrade` is mutating and should be treated as guarded:

- Require explicit user intent.
- Require `confirm=true`.
- Prefer preview/decision tools first (`check`, `doctor`, `predict`, `review`).

## Error handling contract

Check `error.data.code` for deterministic handling:

- `UNKNOWN_TOOL`
- `INVALID_PARAMS`
- `TOOL_TIMEOUT`
- `OVERLOADED`
- `CONFIRMATION_REQUIRED`

Retry guidance:

- Retry once for `TOOL_TIMEOUT` or `OVERLOADED`.
- For `INVALID_PARAMS`, correct payload and retry.
- For `CONFIRMATION_REQUIRED`, request user confirmation before retry.

## Engine modes

Rainy ships phased MCP engines:

- `RAINY_MCP_ENGINE=legacy` (default)
- `RAINY_MCP_ENGINE=sdk` (official SDK path)
- `RAINY_MCP_ENGINE_FALLBACK=0` to disable fallback while validating SDK mode

