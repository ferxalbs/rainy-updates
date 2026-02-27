# @rainy-updates/cli

Agentic CLI to detect, control, and apply dependency updates across npm/pnpm projects and monorepos.

`@rainy-updates/cli` is built for teams that need fast dependency intelligence, policy-aware upgrades, and automation-ready output for CI/CD and pull request workflows.

## Why this package

- Detects updates quickly across single-package repos and workspaces.
- Applies updates safely with configurable targets (`patch`, `minor`, `major`, `latest`).
- Enforces policy rules per package (ignore rules and max upgrade level).
- Supports offline and cache-warmed execution for deterministic CI runs.
- Produces machine-readable artifacts (JSON, SARIF, GitHub outputs, PR markdown report).

## Install

```bash
npm i -D @rainy-updates/cli
# or
pnpm add -D @rainy-updates/cli
```

## Core commands

- `check`: analyze dependencies and report available updates.
- `upgrade`: rewrite dependency ranges in manifests, optionally install lockfile updates.
- `warm-cache`: prefetch package metadata for fast and offline checks.

## Quick usage

```bash
# 1) Detect updates
npx @rainy-updates/cli check --format table

# 2) Strict CI mode (non-zero when updates exist)
npx @rainy-updates/cli check --workspace --ci --format json --json-file .artifacts/updates.json

# 3) Apply upgrades with workspace sync
npx @rainy-updates/cli upgrade --target latest --workspace --sync --install

# 4) Warm cache for deterministic offline checks
npx @rainy-updates/cli warm-cache --workspace --concurrency 32
npx @rainy-updates/cli check --workspace --offline --ci
```

## What it does in production

### Update detection engine

- Scans dependency groups: `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies`.
- Resolves versions per unique package to reduce duplicate network requests.
- Uses network concurrency controls and resilient retries.
- Supports stale-cache fallback when registry calls fail.

### Workspace support

- Detects package workspaces from:
  - `package.json` workspaces
  - `pnpm-workspace.yaml`
- Handles multi-manifest upgrade flows.
- Graph-aware sync mode (`--sync`) avoids breaking `workspace:*` references.

### Policy-aware control

- Apply global ignore patterns.
- Apply package-specific rules.
- Enforce max upgrade target per package (for safer rollout).

Example policy file:

```json
{
  "ignore": ["@types/*", "eslint*"],
  "packageRules": {
    "react": { "maxTarget": "minor" },
    "typescript": { "ignore": true }
  }
}
```

Use it with:

```bash
npx @rainy-updates/cli check --policy-file .rainyupdates-policy.json
```

## Output and reporting

### Human output

- `--format table`
- `--format minimal`

### Automation output

- `--format json`
- `--json-file <path>`
- `--sarif-file <path>`
- `--github-output <path>`
- `--pr-report-file <path>`

These outputs are designed for CI pipelines, security tooling, and PR review automation.

## Command options

### Global

- `--cwd <path>`
- `--workspace`
- `--target patch|minor|major|latest`
- `--filter <pattern>`
- `--reject <pattern>`
- `--dep-kinds deps,dev,optional,peer`
- `--concurrency <n>`
- `--cache-ttl <seconds>`
- `--offline`
- `--policy-file <path>`
- `--format table|json|minimal|github`
- `--json-file <path>`
- `--github-output <path>`
- `--sarif-file <path>`
- `--pr-report-file <path>`
- `--ci`

### Upgrade-only

- `--install`
- `--pm auto|npm|pnpm`
- `--sync`

## Config support

Configuration can be loaded from:

- `.rainyupdatesrc`
- `.rainyupdatesrc.json`
- `package.json` field: `rainyUpdates`

## CLI help

```bash
rainy-updates --help
rainy-updates <command> --help
rainy-updates --version
```

## Reliability characteristics

- Node.js 20+ runtime.
- Works with npm and pnpm workflows.
- Uses optional `undici` pool path for high-throughput HTTP.
- Cache-first architecture for speed and resilience.

## License

MIT
