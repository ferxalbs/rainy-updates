# @rainy-updates/cli

Agentic OSS CLI for dependency updates focused on speed, CI automation, and workspace-scale maintenance.

## Install

```bash
npm i -D @rainy-updates/cli
# or
pnpm add -D @rainy-updates/cli
```

## Commands

- `check`: detect available dependency updates.
- `upgrade`: rewrite dependency ranges (optional install + workspace sync).
- `warm-cache`: pre-fetch package metadata into local cache for faster CI checks.
- `init-ci`: scaffold `.github/workflows/rainy-updates.yml`.

## Quick start

```bash
# check and fail CI if updates are found
npx @rainy-updates/cli check --ci --format json --json-file .artifacts/deps-report.json

# pre-warm cache before strict offline checks
npx @rainy-updates/cli warm-cache --workspace --concurrency 32
npx @rainy-updates/cli check --workspace --offline --ci

# upgrade ranges and install lockfiles
npx @rainy-updates/cli upgrade --target latest --workspace --sync --install

# scaffold GitHub Actions workflow
npx @rainy-updates/cli init-ci
```

## Core options

- `--target patch|minor|major|latest`
- `--filter <pattern>`
- `--reject <pattern>`
- `--dep-kinds deps,dev,optional,peer`
- `--workspace`
- `--concurrency <n>`
- `--cache-ttl <seconds>`
- `--offline` (cache-only mode)
- `--cwd <path>`

## Output options

- `--format table|json|minimal|github`
- `--json-file <path>`
- `--github-output <path>`
- `--sarif-file <path>`
- `--pr-report-file <path>` (generates markdown report for PR comments)

## Upgrade options

- `--install`
- `--pm auto|npm|pnpm`
- `--sync` (graph-aware version alignment across workspace packages)

## Policy controls

- `--policy-file <path>` to apply package-level policy rules.
- default policy discovery:
  - `.rainyupdates-policy.json`
  - `rainy-updates.policy.json`

Policy example:

```json
{
  "ignore": ["@types/*", "eslint*"],
  "packageRules": {
    "react": { "maxTarget": "minor" },
    "typescript": { "ignore": true }
  }
}
```

## CLI help

```bash
rainy-updates --help
rainy-updates <command> --help
rainy-updates --version
```

## CI behavior

- `--ci`: returns exit code `1` when updates are found.
- returns exit code `2` for operational errors (registry/IO/runtime failures).

## Config files

Supported:

- `.rainyupdatesrc`
- `.rainyupdatesrc.json`
- `package.json` -> `rainyUpdates`

Example:

```json
{
  "rainyUpdates": {
    "target": "minor",
    "workspace": true,
    "concurrency": 24,
    "offline": false,
    "format": "json",
    "cacheTtlSeconds": 1800,
    "jsonFile": ".artifacts/deps.json",
    "sarifFile": ".artifacts/deps.sarif",
    "prReportFile": ".artifacts/deps.md",
    "policyFile": ".rainyupdates-policy.json"
  }
}
```

## Production release

```bash
bun run prepublishOnly
node scripts/release-preflight.mjs
npm publish --provenance --access public
```

If publishing in GitHub Actions, set `NPM_TOKEN` in repository secrets.

The repository includes:

- `.github/workflows/ci.yml` for test/typecheck/build/smoke checks.
- `.github/workflows/release.yml` for tag-driven npm publishing.

## Performance and runtime notes

- Resolves dependency metadata by unique package name to avoid duplicate network calls.
- Uses `undici` pool with HTTP/2 when available; falls back to native `fetch` automatically.
- Uses layered cache with stale fallback for resilient CI runs.
