# @rainy-updates/cli

Rainy Updates is a deterministic dependency review and upgrade operator for Node monorepos and CI.

`@rainy-updates/cli` is built for teams that need fast dependency detection, trustworthy review, controlled upgrades, and automation-ready outputs for CI/CD.

## Overview

Rainy Updates gives teams one dependency lifecycle:

1. **`check`** — detects candidate updates
2. **`doctor`** — summarizes the current situation
3. **`predict`** — estimates upgrade break risk before applying changes
4. **`review`** / **`dashboard`** — decides what should happen (interactive decision surface)
5. **`upgrade`** — applies the approved change set

Everything else supports that lifecycle: CI orchestration, advisory lookup, peer resolution, licenses, snapshots, baselines, and fix-PR automation.

### For whom

- Node monorepo teams that want deterministic CI artifacts
- Engineers who want to review dependency risk locally before applying changes
- Teams that need fewer, better upgrade decisions instead of noisy automated PR churn

### Why use it

- Detects updates quickly across single-package repos and workspaces
- Centralizes security, peer, license, health, and behavioral risk review
- Applies updates safely with configurable targets (`patch`, `minor`, `major`, `latest`)
- Enforces policy rules per package
- Supports offline and cache-warmed execution for deterministic CI runs
- Produces machine-readable artifacts: JSON, SARIF, GitHub outputs, and PR reports

## Quick start

```bash
# 1) Detect what changed
bunx --bun @rainy-updates/cli check --workspace --show-impact

# 2) Summarize what matters
bunx --bun @rainy-updates/cli doctor --workspace

# 3) Decide in the dashboard
bunx --bun @rainy-updates/cli dashboard --mode review --plan-file .artifacts/decision-plan.json

# 4) Predict break risk
bunx --bun @rainy-updates/cli predict --workspace

# 5) Apply the approved plan
bunx --bun @rainy-updates/cli upgrade --from-plan .artifacts/decision-plan.json
```

## Installation

### Fast install (global)

Pick one:

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

### Option 1: Bun runtime (recommended, no install needed)

```bash
bunx --bun @rainy-updates/cli check
bunx --bun @rainy-updates/cli audit --severity high
bunx --bun @rainy-updates/cli ci --workspace --mode strict
```

### Option 2: Project dependency

```bash
npm install --save-dev @rainy-updates/cli
pnpm add -D @rainy-updates/cli
bun add -d @rainy-updates/cli
```

Then use via `rup`, `rainy-up`, or `rainy-updates`:

```bash
rup check
rainy-up doctor --workspace
rainy-updates upgrade --from-plan .artifacts/decision-plan.json
```

### Option 3: Standalone binaries

Download pre-compiled binaries from [GitHub Releases](https://github.com/rainy-updates/cli/releases) for:

- Linux x64 / arm64
- macOS x64 / arm64
- Windows x64

Each release includes:
- `rup` — human CLI
- `rup-mcp` — editor and agent integrations

### Option 4: npx (compatibility)

```bash
npx @rainy-updates/cli check
npx @rainy-updates/cli audit --severity high
```

> **Note:** Bun runtime is fastest. npm/npx are supported compatibility paths.

## Commands

### Core workflow

| Command | Purpose |
|---------|---------|
| `check` | Detect candidate dependency updates |
| `doctor` | Summarize current dependency health |
| `review` | Decide what to do with security, risk, peer, and policy context |
| `predict` | Estimate break risk and confidence before applying |
| `dashboard` | Interactive decision console (primary UI) |
| `upgrade` | Apply the approved change set |

### Security & health

| Command | Purpose |
|---------|---------|
| `audit` | Scan for CVEs using OSV.dev + GitHub Advisory Database |
| `health` | Detect stale, deprecated, and unmaintained packages |
| `bisect` | Binary-search to find which version broke your tests |

### CI & automation

| Command | Purpose |
|---------|---------|
| `ci` | Run CI-focused dependency automation with policy gates |
| `warm-cache` | Prefetch package metadata for fast offline checks |
| `baseline` | Save and compare dependency baseline snapshots |
| `ga` | Audit GA and CI readiness for current checkout |

### Utilities

| Command | Purpose |
|---------|---------|
| `explain` | Summarize a package update with risk, changelog, and security context |
| `watch` | Monitor dependency updates and advisories |
| `self-update` | Check/apply Rainy CLI global updates |
| `mcp` | Run local MCP server for AI agents |
| `init-ci` | Generate GitHub Actions workflow |
| `reachability` | Estimate advisory exploitability reachability |
| `exceptions` | Manage VEX-like advisory exceptions |

## Usage examples

### Detection & review

```bash
# Detect updates with impact analysis
rup check --format table
rup check --workspace --show-impact

# Summarize dependency health
rup doctor --workspace
rup doctor --verdict-only

# Review with risk context
rup review --security-only
rup review --risk high --diff major
rup dashboard --mode review --plan-file .artifacts/decision-plan.json
```

### Security & health

```bash
# Scan for CVEs
rup audit
rup audit --severity high
rup audit --summary
rup audit --fix          # prints install command for detected package manager

# Check maintenance health
rup health
rup health --stale 6m   # flag packages with no release in 6 months
rup health --stale 180d # same but in days

# Find breaking version
rup bisect axios --cmd "bun test"
rup bisect react --range "18.0.0..19.0.0" --cmd "npm test"
rup bisect lodash --cmd "npm run test:unit" --dry-run
```

### Upgrade & verification

```bash
# Apply approved plan with verification
rup upgrade --from-plan .artifacts/decision-plan.json
rup upgrade \
  --from-plan .artifacts/decision-plan.json \
  --verify install,test \
  --test-command "bun test" \
  --verification-report-file .artifacts/verification.json

# Explain a package update
rup explain react
```

### CI & automation

```bash
# Warm cache for deterministic offline CI
rup warm-cache --workspace --concurrency 32
rup check --workspace --offline --ci

# Save and compare baseline drift
rup baseline --save --file .artifacts/deps-baseline.json --workspace
rup baseline --check --file .artifacts/deps-baseline.json --workspace --ci

# CI orchestration with policy gates
rup ci --workspace --mode strict --gate review --plan-file .artifacts/decision-plan.json --format github
rup ci --workspace --mode strict --gate upgrade --from-plan .artifacts/decision-plan.json --verify test --test-command "npm test"

# Batch fix branches by scope (enterprise)
rup ci --workspace --mode enterprise --group-by scope --fix-pr --fix-pr-batch-size 2

# Audit CI readiness
rup ga --workspace

# Generate GitHub Actions workflow
rup init-ci --mode enterprise --schedule weekly
rup init-ci --mode minimal --schedule daily
rup init-ci --target cron --mode strict --schedule daily
rup init-ci --target systemd --mode strict --schedule weekly
```

### Monitoring

```bash
# Watch for updates and advisories
rup watch --workspace --severity high

# Reachability and exceptions
rup reachability --workspace --format summary
rup exceptions list --active-only
```

## Configuration

### Policy file

Control upgrade behavior with `.rainyupdates-policy.json`:

```json
{
  "ignore": ["@types/*", "eslint*"],
  "packageRules": {
    "react": { "maxTarget": "minor", "target": "patch", "autofix": false },
    "typescript": { "ignore": true }
  }
}
```

Use it with:

```bash
rup check --policy-file .rainyupdates-policy.json
```

### Config file

Configuration can be loaded from:

- `.rainyupdatesrc`
- `.rainyupdatesrc.json`
- `package.json` field: `rainyUpdates`

### Environment

- `.env` files are auto-loaded by Bun
- `.npmrc` is read for private package registries
- `FORCE_COLOR=0` disables colored output (useful for CI)

## AI Agents (MCP)

Rainy Updates runs as a **local MCP server** for Claude Desktop, Cursor, and other MCP-capable agents to inspect dependency health.

### 5-minute setup

1) Install globally (`rup`) using the commands above.

2) Add this MCP JSON entry:

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

3) If your client doesn't inherit `PATH`, use absolute binary path:

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

4) Start asking:

- `Run rup_doctor for this workspace`
- `Show high-risk updates with rup_review`
- `Check critical CVEs with rup_audit`

Generate config JSON automatically:

```bash
rup mcp --print-config --client claude
rup mcp --print-config --client cursor
rup mcp --print-config --client generic
```

### More client examples

Cursor example:

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

If your MCP client does not send `cwd` per tool call, you can also define a persistent default path in config:

```json
{
  "mcp": {
    "cwd": "/Users/<you>/your-repo"
  }
}
```

### Transport options

- **Default:** `stdio` via `rup-mcp`
- **HTTP:** `rup-mcp --transport http --port 3741 --http-path /mcp`
- **Auth:** `rup-mcp --transport http --port 3741 --auth-token local-dev-token`
- **Reliability controls:** `--max-inflight 4 --max-queue 64 --tool-timeout-ms 30000 --initialize-timeout-ms 10000`
- **Diagnostics:** `--diag-json` emits structured MCP diagnostics to `stderr`

### MCP engine mode

Rainy includes a phased SDK migration path:

- `RAINY_MCP_ENGINE=legacy` (default): current production MCP engine
- `RAINY_MCP_ENGINE=sdk`: official `@modelcontextprotocol/sdk` engine path
- `RAINY_MCP_ENGINE_FALLBACK=0`: disable automatic fallback when `sdk` engine fails

Docs: [MCP quickstart](./docs/mcp-install.md) · [Compatibility guide](./docs/mcp-compatibility.md) · [Agent playbook](./docs/agent-playbook.md) · [MCP overview](./docs/mcp.md) · [Tools reference](./docs/mcp-tools.md) · [Claude Desktop](./docs/mcp-claude-desktop.md) · [Cursor](./docs/mcp-cursor.md) · [Security model](./docs/mcp-security-model.md)

## Documentation

- [Command model](./docs/command-model.md) — Check → Doctor → Review → Upgrade
- [MCP quickstart](./docs/mcp-install.md) — Copy-paste setup for MCP clients
- [MCP compatibility](./docs/mcp-compatibility.md) — Multi-client and multi-environment setup
- [Agent playbook](./docs/agent-playbook.md) — Best practices for agent workflows
- [Review workflow](./docs/review-workflow.md) — Decision-making guide
- [TUI guide](./docs/tui-guide.md) — Dashboard usage
- [Risk engine](./docs/risk-engine.md) — Risk assessment methodology
- [Benchmarks](./docs/benchmarks.md) — Performance methodology
- [Comparison](./docs/why-rainy-vs-dependabot-renovate.md) — vs Dependabot & Renovate
- [Roadmap](./ROADMAP.md) — Long-term vision

## Health badge

Publish dependency health to a Shields badge:

```md
![Repo Health](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ferxalbs/rainy-updates/gh-pages/badges/health.json)
```

Generate with:

```bash
rup doctor --badge-file .public/badges/health.json
```

Then publish to `gh-pages` branch.

## License
MIT
