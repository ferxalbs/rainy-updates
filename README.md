# @rainy-updates/cli

The fastest DevOps-first dependency CLI. Checks, audits, upgrades, bisects, and automates npm/pnpm dependencies in CI.

`@rainy-updates/cli` is built for teams that need fast dependency intelligence, security auditing, policy-aware upgrades, and automation-ready output for CI/CD and pull request workflows.

Comparison:
[Why Rainy vs Dependabot and Renovate](./docs/why-rainy-vs-dependabot-renovate.md)

## Why this package

- Detects updates quickly across single-package repos and workspaces.
- Applies updates safely with configurable targets (`patch`, `minor`, `major`, `latest`).
- Enforces policy rules per package (ignore rules and max upgrade level).
- Supports offline and cache-warmed execution for deterministic CI runs.
- Produces machine-readable artifacts (JSON, SARIF, GitHub outputs, PR markdown report).

## Install

```bash
# As a project dev dependency (recommended for teams)
npm install --save-dev @rainy-updates/cli
# or
pnpm add -D @rainy-updates/cli
```

Once installed, three binary aliases are available in your `node_modules/.bin/`:

| Alias           | Use case                                    |
| --------------- | ------------------------------------------- |
| `rup`           | Power-user shortcut — `rup ci`, `rup audit` |
| `rainy-up`      | Human-friendly — `rainy-up check`           |
| `rainy-updates` | Backwards-compatible (safe in CI scripts)   |

```bash
# All three are identical — use whichever you prefer:
rup check
rainy-up check
rainy-updates check
```

### One-off usage with npx (no install required)

```bash
# Always works without installing:
npx @rainy-updates/cli check
npx @rainy-updates/cli audit --severity high
npx @rainy-updates/cli ci --workspace --mode strict
```

> **Note:** The short aliases (`rup`, `rainy-up`) only work after installing the package. For one-off `npx` runs, use `npx @rainy-updates/cli <command>`.

## Commands

### Dependency management

- `check` — analyze dependencies and report available updates
- `upgrade` — rewrite dependency ranges in manifests, optionally install lockfile updates
- `ci` — run CI-focused dependency automation (warm cache, check/upgrade, policy gates)
- `warm-cache` — prefetch package metadata for fast and offline checks
- `baseline` — save and compare dependency baseline snapshots
- `review` — guided review across updates, security, peer conflicts, licenses, and risk
- `doctor` — fast verdict command for local triage and CI summaries

### Security & health (_new in v0.5.1_)

- `audit` — scan dependencies for CVEs using [OSV.dev](https://osv.dev) plus GitHub Advisory Database, with lockfile-aware version inference
- `health` — detect stale, deprecated, and unmaintained packages before they become liabilities
- `bisect` — binary-search across semver versions to find the exact version that broke your tests

## Quick usage

> Commands work with `npx` (no install) **or** with the `rup` / `rainy-up` shortcut if the package is installed.

```bash
# 1) Detect updates
npx @rainy-updates/cli check --format table
rup check --format table                      # if installed

# 2) Strict CI mode (non-zero when updates exist)
npx @rainy-updates/cli check --workspace --ci --format json --json-file .artifacts/updates.json
rup check --workspace --ci --format json --json-file .artifacts/updates.json

# 3) CI orchestration with policy gates
npx @rainy-updates/cli ci --workspace --mode strict --format github
rup ci --workspace --mode strict --format github

# 4) Batch fix branches by scope (enterprise)
npx @rainy-updates/cli ci --workspace --mode enterprise --group-by scope --fix-pr --fix-pr-batch-size 2
rup ci --workspace --mode enterprise --group-by scope --fix-pr --fix-pr-batch-size 2

# 5) Apply upgrades with workspace sync
npx @rainy-updates/cli upgrade --target latest --workspace --sync --install
rup upgrade --target latest --workspace --sync --install

# 6) Warm cache → deterministic offline CI check
npx @rainy-updates/cli warm-cache --workspace --concurrency 32
npx @rainy-updates/cli check --workspace --offline --ci

# 7) Save and compare baseline drift
npx @rainy-updates/cli baseline --save --file .artifacts/deps-baseline.json --workspace
npx @rainy-updates/cli baseline --check --file .artifacts/deps-baseline.json --workspace --ci

# 8) Scan for known CVEs  ── NEW in v0.5.1
npx @rainy-updates/cli audit
npx @rainy-updates/cli audit --severity high
npx @rainy-updates/cli audit --summary
npx @rainy-updates/cli audit --source osv
npx @rainy-updates/cli audit --fix          # prints the patching npm install command
rup audit --severity high                   # if installed

`audit` prefers npm/pnpm lockfiles today for exact installed-version inference, and now also reads simple `bun.lock` workspace entries when available. It reports source-health warnings when OSV or GitHub returns only partial coverage.

# 9) Check dependency maintenance health  ── NEW in v0.5.1
npx @rainy-updates/cli health
npx @rainy-updates/cli health --stale 6m   # flag packages with no release in 6 months
npx @rainy-updates/cli health --stale 180d # same but in days
rup health --stale 6m                       # if installed

# 10) Find which version introduced a breaking change  ── NEW in v0.5.1
npx @rainy-updates/cli bisect axios --cmd "bun test"
npx @rainy-updates/cli bisect react --range "18.0.0..19.0.0" --cmd "npm test"
npx @rainy-updates/cli bisect lodash --cmd "npm run test:unit" --dry-run
rup bisect axios --cmd "bun test"           # if installed

# 11) Review updates with risk and security context  ── NEW in v0.5.2 GA
npx @rainy-updates/cli review --security-only
rup review --interactive
rup review --risk high --diff major

# 12) Get a fast dependency verdict for CI or local triage  ── NEW in v0.5.2 GA
npx @rainy-updates/cli doctor
rup doctor --verdict-only
```

## What it does in production

### Update detection engine

- Scans dependency groups: `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies`.
- Resolves versions per unique package to reduce duplicate network requests.
- Uses network concurrency controls and resilient retries.
- Supports explicit registry retry/timeout tuning (`--registry-retries`, `--registry-timeout-ms`).
- Supports stale-cache fallback when registry calls fail.
- Supports streamed progress output for long CI runs (`--stream`).
- Exposes impact/risk metadata and homepage context in update output (`--show-impact`, `--show-homepage`).

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
- Support per-package target override and fix-pr inclusion (`target`, `autofix`).

Example policy file:

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

## Automatic CI bootstrap

Generate a workflow in the target project automatically:

```bash
# enterprise mode (recommended)
rup init-ci --mode enterprise --schedule weekly

# lightweight mode
rup init-ci --mode minimal --schedule daily
```

Generated file:

- `.github/workflows/rainy-updates.yml`

Modes:

- `strict`: warm-cache + offline check + artifacts + SARIF upload.
- `enterprise`: strict checks + runtime matrix + retention policy + rollout gates.
- `minimal`: fast check-only workflow for quick adoption.

Schedule:

- `weekly`, `daily`, or `off` (manual dispatch only).

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
- `--registry-timeout-ms <n>`
- `--registry-retries <n>`
- `--offline`
- `--stream`
- `--fail-on none|patch|minor|major|any`
- `--max-updates <n>`
- `--group-by none|name|scope|kind|risk`
- `--group-max <n>`
- `--cooldown-days <n>`
- `--pr-limit <n>`
- `--only-changed`
- `--interactive`
- `--show-impact`
- `--show-homepage`
- `--mode minimal|strict|enterprise` (for `ci`)
- `--fix-pr-batch-size <n>` (for batched fix branches in `ci`)
- `--policy-file <path>`
- `--format table|json|minimal|github`
- `--json-file <path>`
- `--github-output <path>`
- `--sarif-file <path>`
- `--pr-report-file <path>`
- `--fix-pr`
- `--fix-branch <name>`
- `--fix-commit-message <text>`
- `--fix-dry-run`
- `--lockfile-mode preserve|update|error`
- `--no-pr-report`
- `--ci`

### Upgrade-only

- `--install`
- `--pm auto|npm|pnpm`
- `--sync`

### Review-only

- `--security-only`
- `--risk critical|high|medium|low`
- `--diff patch|minor|major|latest`
- `--apply-selected`

### Doctor-only

- `--verdict-only`

### Baseline-only

- `--save`
- `--check`
- `--file <path>`

## Config support

Configuration can be loaded from:

- `.rainyupdatesrc`
- `.rainyupdatesrc.json`
- `package.json` field: `rainyUpdates`

## CLI help

```bash
rup --help
rup <command> --help
rup --version

# or with the full name:
rainy-updates --help
npx @rainy-updates/cli --help
```

## Reliability characteristics

- Node.js 20+ runtime.
- Works with npm and pnpm workflows.
- Uses optional `undici` pool path for high-throughput HTTP.
- Reads `.npmrc` default and scoped registries for private package environments.
- Cache-first architecture for speed and resilience.

## CI/CD included

This package ships with production CI/CD pipelines in the repository:

- Continuous integration pipeline for typecheck, tests, build, and production smoke checks.
- Performance smoke gate (`perf:smoke`) to catch startup/runtime regressions in CI.
- Tag-driven release pipeline for npm publishing with provenance.
- Release preflight validation for npm auth/scope checks before publishing.

## Product roadmap

The long-term roadmap is maintained in [`ROADMAP.md`](./ROADMAP.md).

## License

MIT
