# Changelog

All notable changes to this project are documented in this file.

## [0.5.0-rc.4] - 2026-02-27

### Changed

- Hardened deterministic CI artifacts:
  - stable key ordering for JSON and SARIF files,
  - deterministic sorting for updates, warnings, and errors in output pipelines.
- Improved fail-reason classification consistency for registry/runtime failures across commands.
- Fix-PR metadata in summary now has stable defaults (`fixPrApplied`, `fixBranchName`, `fixCommitSha`) to reduce contract drift.
- Fix-PR staging now includes only updated manifests plus explicit report files, with deterministic file ordering.
- Added warning when Bun runtime falls back from SQLite cache backend to file cache backend.

### Added

- Added `perf:smoke` script and CI gate to enforce a basic performance regression threshold.
- Added deterministic output and summary regression tests.

## [0.5.0-rc.2] - 2026-02-27

### Added

- New fix-PR automation flags for CI branch workflows:
  - `--fix-pr`
  - `--fix-branch <name>`
  - `--fix-commit-message <text>`
  - `--fix-dry-run`
  - `--no-pr-report`
- New summary metadata for fix-PR execution:
  - `fixPrApplied`
  - `fixBranchName`
  - `fixCommitSha`
- New GitHub output values for fix-PR state:
  - `fix_pr_applied`
  - `fix_pr_branch`
  - `fix_pr_commit`
- Added command-specific help output for `check --help`.

### Changed

- `check --fix-pr` now executes update application flow to support branch+commit automation without requiring `upgrade`.
- Default PR report path is auto-assigned when `--fix-pr` is enabled: `.artifacts/deps-report.md`.
- CLI path-like options are resolved against the final effective `--cwd` value (stable behavior when option order varies).
- Workspace discovery now supports recursive patterns (`**`) and negated patterns (`!pattern`) with safer directory traversal defaults.
- Registry resolution now loads `.npmrc` scope mappings (`@scope:registry=...`) from user and project config.

### Fixed

- Prevented stale output contracts by writing fix-PR metadata into JSON/GitHub/SARIF artifact flow after git automation is resolved.

### Tests

- Added parser tests for fix-PR flags and final-cwd path resolution.
- Added workspace discovery coverage for recursive and negated patterns.
- Added fix-PR dry-run workflow test in temporary git repos.
- Extended GitHub output tests for new fix-PR keys.

## [0.5.0-rc.1] - 2026-02-27

### Added

- New CI rollout controls:
  - `--fail-on none|patch|minor|major|any`
  - `--max-updates <n>`
- New baseline workflow command:
  - `baseline --save --file <path>` to snapshot dependency state
  - `baseline --check --file <path>` to detect dependency drift
- New `init-ci --mode enterprise` template:
  - Node runtime matrix (`20`, `22`)
  - stricter default permissions
  - artifact retention policy
  - built-in rollout gate flags (`--fail-on`, `--max-updates`)

### Changed

- Dependency target selection now evaluates available package versions from registry metadata, improving `patch|minor|major` accuracy.
- CLI parser now rejects unknown options and missing option values with explicit errors (safer CI behavior).
- SARIF output now reports the actual package version dynamically.

### Tests

- Added baseline snapshot/diff tests.
- Added enterprise workflow generation tests.
- Added semver target selection tests using available version sets.
- Added parser tests for baseline command, rollout flags, and unknown option rejection.

## [0.4.4] - 2026-02-27

### Changed

- Version bump to `0.4.4` for production stabilization.
- Simplified public documentation to focus on end-user CLI usage.
- Removed user-facing instructions for GitHub Actions configuration from README.

### Fixed

- Removed optional `better-sqlite3` dependency to avoid deprecated native install warnings (`prebuild-install`).
- Cache backend now uses `bun:sqlite` when available and falls back cleanly to file-based cache without native Node addons.

### Added

- `SECURITY.md` with vulnerability disclosure guidance.
- `CODE_OF_CONDUCT.md` for OSS community standards.
- Automatic CI bootstrap improvements in `init-ci`:
  - `--mode minimal|strict`
  - `--schedule weekly|daily|off`
  - package-manager-aware install step generation (npm/pnpm)


## [0.4.0] - 2026-02-27

### Added

- Production hardening for CLI UX:
  - global and command-level help (`--help`, `-h`),
  - version output (`--version`, `-v`),
  - strict unknown command rejection.
- OSS/release infrastructure:
  - `LICENSE` (MIT),
  - `CONTRIBUTING.md`,
  - project CI workflow (`.github/workflows/ci.yml`),
  - npm release workflow (`.github/workflows/release.yml`).
- Packaging stabilization:
  - `types` export path,
  - production scripts (`clean`, `test:prod`, `prepublishOnly`),
  - publish config with npm provenance and public access.

### Changed

- Registry client now retries latest-version resolution with backoff for transient failures.
- Output formatting now shows cache warming summary when relevant.

### Fixed

- Parser now fails fast for unknown commands instead of silently defaulting to `check`.

## [0.3.0] - 2026-02-27

### Added

- `warm-cache` command:
  - pre-fetches package metadata into cache,
  - supports workspace scanning,
  - supports offline behavior with explicit cache-miss reporting.
- `init-ci` command:
  - scaffolds `.github/workflows/rainy-updates.yml`,
  - supports `--force` overwrite behavior.
- Policy engine:
  - `--policy-file` to load package update rules,
  - default discovery of `.rainyupdates-policy.json` and `rainy-updates.policy.json`,
  - rule-level controls:
    - global ignore patterns,
    - per-package ignore,
    - per-package `maxTarget` update ceiling.
- PR report output:
  - `--pr-report-file` emits markdown report for pull request comments.
- New summary metric:
  - `warmedPackages` in results and GitHub output values.
- New tests:
  - warm cache behavior,
  - policy loading,
  - CI workflow scaffolding,
  - PR markdown report rendering,
  - parser support for new commands/flags.

### Changed

- Check pipeline now applies policy constraints before update proposals.
- Output summary now includes warmed cache package count.
- CLI command parser supports additional commands (`warm-cache`, `init-ci`) and options (`--policy-file`, `--pr-report-file`, `--force`).

## [0.2.0] - 2026-02-27

### Added

- High-throughput registry resolution architecture:
  - batched unique package resolution,
  - configurable concurrency with `--concurrency`,
  - optional `undici` pool + HTTP/2 path when available,
  - automatic fallback to native `fetch` when `undici` is unavailable.
- Offline execution mode:
  - `--offline` runs in cache-only mode,
  - reports cache misses explicitly for deterministic CI behavior.
- Workspace graph module:
  - detects local package graph,
  - computes topological order,
  - detects simple cycle groups and surfaces warnings.
- Graph-aware sync in upgrade flow:
  - `--sync` now aligns versions following workspace graph order,
  - preserves `workspace:*` protocol references.
- Additional test coverage:
  - workspace graph ordering,
  - workspace protocol edge handling,
  - offline cache miss behavior.

### Changed

- `check` pipeline now resolves versions by unique dependency name first, then applies results across all manifests.
- stale cache fallback is applied after registry failures to reduce flaky CI checks.
- options/config surface expanded with `offline` and stronger CI-oriented controls.

### OSS Quality

- README expanded with performance/runtime notes and complete options matrix.
- Output and artifact model reinforced for CI systems (JSON, GitHub outputs, SARIF).

## [0.1.0] - 2026-02-27

### Added

- New npm package identity: `@rainy-updates/cli` with CLI binary `rainy-updates`.
- Core commands:
  - `check` for update detection.
  - `upgrade` for manifest rewriting with optional installation step.
- Multi-format output system:
  - `table`, `json`, `minimal`, and `github` annotation output.
- CI artifact outputs:
  - `--json-file` for machine-readable check results.
  - `--github-output` for key-value GitHub Actions outputs.
  - `--sarif-file` for SARIF 2.1.0 compatible reports.
- Configuration support:
  - `.rainyupdatesrc`
  - `.rainyupdatesrc.json`
  - `package.json` field: `rainyUpdates`
- Workspace-aware scanning (`--workspace`):
  - `package.json` workspaces detection.
  - `pnpm-workspace.yaml` package pattern detection.
- Workspace upgrade harmonization:
  - `--sync` aligns dependency versions across scanned manifests.
- Dependency category filtering:
  - `--dep-kinds deps,dev,optional,peer`
- Runtime controls:
  - `--concurrency` for parallel dependency checks.
- `--cache-ttl` for cache freshness tuning.
- Cache layer improvements:
  - SQLite-first cache backend when available.
  - JSON fallback cache backend.
  - stale cache fallback path when registry requests fail.
- Programmatic exports:
  - `check`, `upgrade`, SARIF and GitHub output helpers.
- Test suite expanded with coverage for:
  - semver utilities,
  - CLI option parsing,
  - config loading,
  - workspace discovery,
  - SARIF generation,
  - GitHub output writing.

### Changed

- Project structure refactored into modular layers (`core`, `config`, `workspace`, `output`, `cache`, `registry`, `pm`, `utils`, `types`).
- CLI parser upgraded to async workflow to support config loading and cwd-based config resolution.
- Upgrade pipeline now supports writing updates across multiple workspace package manifests.

### Fixed

- Argument parsing now correctly handles flags when command is omitted (`check` default mode).
- Type-safe discriminated command parsing for `check` vs `upgrade` options.

### Notes

- In network-restricted environments, registry lookups fail gracefully and return exit code `2` with detailed error output.
- `pnpm` and `npm` are the official package-manager scope for this release.
