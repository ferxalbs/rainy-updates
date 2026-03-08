# MCP Tools Reference

This document defines the stable MCP tool contract for `@rainy-updates/cli`.

## Transport and protocol

- Recommended transport: `stdio` via `rup-mcp`.
- Protocol versions accepted by server: `2024-11-05`, `2025-03-26`, `2025-06-18`.
- If a client requests a newer date-like version, the server negotiates down to the latest supported version.

## Response contract

Every successful `tools/call` returns:

- `content`: text payload (pretty JSON string).
- `structuredContent`: machine-readable object (stable contract target for models).
- `isError`: optional boolean.

## Error contract

For tool failures, `error.data` includes structured codes:

- `UNKNOWN_TOOL`: tool name is not exposed by server.
- `INVALID_PARAMS`: request arguments failed schema validation.
- `TOOL_TIMEOUT`: execution exceeded `toolTimeoutMs` (retryable).
- `CONFIRMATION_REQUIRED`: mutating tool called without explicit confirmation.

## Tool catalog (stable names)

### `rup_check`

- Mutating: no
- Purpose: detect candidate dependency updates with risk metadata.
- Key input: `target`, `filter`, `reject`, `includeKinds`, git-scope flags.
- Key output: check result summary + updates list.

### `rup_doctor`

- Mutating: no
- Purpose: summarize dependency health and recommend next action.
- Key input: `onlyChanged`, `includeChangelog`, git-scope flags.
- Key output: `verdict`, `score`, `findings`, `nextAction`.

### `rup_predict`

- Mutating: no
- Purpose: predict upgrade break risk with confidence scoring.
- Scope input (exactly one): `packageName`, `workspace=true`, or `fromPlanFile`.
- Optional input: `includeChangelog`.
- Key output: `prediction`, `riskLevel`, `confidence`, `highestRiskChanges`, `nextCommands`.

### `rup_review`

- Mutating: no
- Purpose: produce reviewed queue + decision plan.
- Key input: `securityOnly`, `risk`, `diff`, `planFile`, git-scope flags.
- Key output: `summary`, `items`, `decisionPlan`.

### `rup_audit`

- Mutating: no
- Purpose: scan dependencies for CVEs (OSV/GitHub).
- Key input: `severity`, `sourceMode`, git-scope flags.
- Key output: advisory findings + source health + summary stats.

### `rup_upgrade`

- Mutating: yes
- Purpose: apply approved dependency plan.
- Required input: `fromPlanFile`, `confirm=true`.
- Optional input: `install`, `sync`, `packageManager`, `verify`, `testCommand`.
- Key output: `changed`, `summary`, `updates`.

### `rup_health`

- Mutating: no
- Purpose: maintenance/staleness/deprecation health reporting.
- Key input: `staleDays`, `includeDeprecated`, `includeAlternatives`.
- Key output: package health findings and status summary.

### `rup_bisect`

- Mutating: no (unless project test command has side effects)
- Purpose: find breaking dependency version via binary search.
- Required input: `packageName`.
- Optional input: `versionRange`, `testCommand`, `dryRun`.
- Key output: bisect trace and identified culprit version.

### `rup_resolve`

- Mutating: no
- Purpose: peer dependency conflict analysis.
- Key input: `afterUpdate`, git-scope flags.
- Key output: conflict graph + resolution guidance.

### `rup_baseline`

- Mutating: yes (when `action=save`)
- Purpose: save/check manifest drift baseline.
- Required input: `action` (`save` or `check`), `filePath`.
- Optional input: `includeKinds`.
- Key output: baseline snapshot metadata or diff results.

### `rup_explain`

- Mutating: no
- Purpose: package-level update explanation.
- Required input: `packageName`.
- Optional input: `fromVersion`, `toVersion`.
- Key output: explanation summary with risk/security/release context.

## Model usage guidance

- Prefer `structuredContent` over parsing text.
- Use read-only tools first (`check` → `doctor` → `predict` → `review`) before mutating operations.
- Only call `rup_upgrade` when:
  - a decision plan exists and
  - `confirm=true` is intentionally provided.
- If `TOOL_TIMEOUT` occurs, retry once with narrower scope (`filter`, `target`, or git-scope flags).
