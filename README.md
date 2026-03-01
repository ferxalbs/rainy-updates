# @rainy-updates/cli

Rainy Updates is a deterministic dependency review and upgrade operator for Node monorepos and CI.

`@rainy-updates/cli` is built for teams that need fast dependency detection, trustworthy review, controlled upgrades, and automation-ready outputs for CI/CD.

Comparison:
[Why Rainy vs Dependabot and Renovate](./docs/why-rainy-vs-dependabot-renovate.md)

Command model:
[Check → Doctor → Review → Upgrade](./docs/command-model.md)

Review workflow:
[Review workflow guide](./docs/review-workflow.md)

Risk engine:
[Risk engine guide](./docs/risk-engine.md)

Benchmarks:
[Benchmark methodology](./docs/benchmarks.md)

## What it is

Rainy Updates gives teams one dependency lifecycle:

- `check` detects candidate updates.
- `doctor` summarizes the current situation.
- `review` decides what should happen.
- `upgrade` applies the approved change set.

Everything else supports that lifecycle: CI orchestration, advisory lookup, peer resolution, licenses, snapshots, baselines, and fix-PR automation.

## Who it is for

- Node monorepo teams that want deterministic CI artifacts.
- Engineers who want to review dependency risk locally before applying changes.
- Teams that need fewer, better upgrade decisions instead of noisy automated PR churn.

## 60-second workflow

```bash
# 1) Detect what changed
npx @rainy-updates/cli check --workspace --show-impact

# 2) Summarize what matters
npx @rainy-updates/cli doctor --workspace

# 3) Decide in the review surface
npx @rainy-updates/cli review --interactive

# 4) Apply the approved set
npx @rainy-updates/cli upgrade --interactive
```

## Why teams use it

- Detects updates quickly across single-package repos and workspaces.
- Centralizes security, peer, license, health, and behavioral risk review.
- Applies updates safely with configurable targets (`patch`, `minor`, `major`, `latest`).
- Enforces policy rules per package.
- Supports offline and cache-warmed execution for deterministic CI runs.
- Produces machine-readable artifacts: JSON, SARIF, GitHub outputs, and PR reports.

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

### Primary workflow

- `check` — detect candidate dependency updates
- `doctor` — summarize the current dependency situation
- `review` — decide what to do with security, risk, peer, and policy context
- `upgrade` — apply the approved change set

### Supporting workflow

- `ci` — run CI-focused dependency automation (warm cache, check/upgrade, policy gates)
- `warm-cache` — prefetch package metadata for fast and offline checks
- `baseline` — save and compare dependency baseline snapshots

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

# 2) Summarize the state
npx @rainy-updates/cli doctor --workspace
rup doctor --workspace

# 3) Review and decide
npx @rainy-updates/cli review --security-only
rup review --interactive

# 4) Apply upgrades with workspace sync
npx @rainy-updates/cli upgrade --target latest --workspace --sync --install
rup upgrade --target latest --workspace --sync --install

# 5) CI orchestration with policy gates
npx @rainy-updates/cli ci --workspace --mode strict --format github
rup ci --workspace --mode strict --format github

# 6) Batch fix branches by scope (enterprise)
npx @rainy-updates/cli ci --workspace --mode enterprise --group-by scope --fix-pr --fix-pr-batch-size 2
rup ci --workspace --mode enterprise --group-by scope --fix-pr --fix-pr-batch-size 2

# 7) Warm cache → deterministic offline CI check
npx @rainy-updates/cli warm-cache --workspace --concurrency 32
npx @rainy-updates/cli check --workspace --offline --ci

# 8) Save and compare baseline drift
npx @rainy-updates/cli baseline --save --file .artifacts/deps-baseline.json --workspace
npx @rainy-updates/cli baseline --check --file .artifacts/deps-baseline.json --workspace --ci

# 9) Scan for known CVEs
npx @rainy-updates/cli audit
npx @rainy-updates/cli audit --severity high
npx @rainy-updates/cli audit --summary
npx @rainy-updates/cli audit --source osv
npx @rainy-updates/cli audit --fix          # prints the patching npm install command
rup audit --severity high                   # if installed

`audit` prefers npm/pnpm lockfiles today for exact installed-version inference, and now also reads simple `bun.lock` workspace entries when available. It reports source-health warnings when OSV or GitHub returns only partial coverage.

# 10) Check dependency maintenance health
npx @rainy-updates/cli health
npx @rainy-updates/cli health --stale 6m   # flag packages with no release in 6 months
npx @rainy-updates/cli health --stale 180d # same but in days
rup health --stale 6m                       # if installed

# 11) Find which version introduced a breaking change
npx @rainy-updates/cli bisect axios --cmd "bun test"
npx @rainy-updates/cli bisect react --range "18.0.0..19.0.0" --cmd "npm test"
npx @rainy-updates/cli bisect lodash --cmd "npm run test:unit" --dry-run
rup bisect axios --cmd "bun test"           # if installed

# 12) Focus review on high-risk changes
rup review --risk high --diff major
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

Review-centered outputs:

- `check` is optimized for detection.
- `doctor` is optimized for summary.
- `review` is optimized for decision-making.
- `upgrade` is optimized for safe application.

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
