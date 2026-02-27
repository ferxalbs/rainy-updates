# @rainy-updates/cli

Agentic OSS CLI for dependency updates focused on speed, CI automation, and workspace-scale maintenance.

## Install

```bash
npm i -D @rainy-updates/cli
# or
pnpm add -D @rainy-updates/cli
```

## Quick start

```bash
# check updates and fail CI if any are found
npx @rainy-updates/cli check --ci --format json --json-file .artifacts/deps-report.json

# upgrade ranges and install lockfiles
npx @rainy-updates/cli upgrade --target latest --workspace --install
```

## Commands

- `check`: detect available dependency updates.
- `upgrade`: rewrite `package.json` ranges; optional install step updates lockfiles.

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

## Upgrade options

- `--install`
- `--pm auto|npm|pnpm`
- `--sync` (graph-aware version alignment across workspace packages)

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
    "sarifFile": ".artifacts/deps.sarif"
  }
}
```

## Performance and runtime notes

- Uses batched unique-package resolution and configurable concurrency.
- Uses `undici` pool with HTTP/2 when available; falls back to native `fetch` automatically.
- Uses layered cache with stale fallback for resilient CI runs.

## GitHub Actions example

```yaml
- name: Check dependency updates
  run: |
    npx @rainy-updates/cli check \
      --workspace \
      --ci \
      --concurrency 32 \
      --format github \
      --json-file .artifacts/deps-report.json \
      --github-output $GITHUB_OUTPUT \
      --sarif-file .artifacts/deps-report.sarif
```
