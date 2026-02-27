# Changelog

All notable changes to this project are documented in this file.

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
