# CHANGELOG

All notable changes to this project are documented in this file.

## [0.5.2-rc.2] - 2026-02-27

### Added

- **Audit RC2 overhaul**:
  - `audit --summary` / `audit --report summary` groups noisy advisory lists into affected-package summaries.
  - `audit --source auto|osv|github|all` adds multi-source security lookups, with `auto` querying **OSV.dev + GitHub Advisory Database** and merging results.
  - Lockfile-backed version inference for `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, and basic `bun.lock` workspace entries resolves real installed versions for complex ranges.
  - JSON audit output now includes package summaries, source metadata, and resolution statistics.
  - Source-health reporting now distinguishes `ok`, `partial`, and `failed` advisory backends so partial coverage is explicit instead of silent.
- **Interactive TUI Engine**: An `ink`-based Terminal User Interface for interactive dependency updates, featuring semantic diff coloring and keyboard navigation (`src/ui/tui.tsx`).
- **Changelog Fetcher**: Implemented `changelog/fetcher.ts` to retrieve release notes dynamically from GitHub API.
  - Utilizes `bun:sqlite` backed `VersionCache` to prevent API rate limit (403) errors.
  - Strictly lazy-loaded to preserve zero-overhead startup time.

### Fixed

- Audit patch planning now chooses the lowest safe patched version that clears all detected vulnerable ranges, avoiding unnecessary major jumps during `audit --fix`.
- Audit findings now record the current installed version and contributing advisory sources per finding.
- Audit now warns when one advisory source degrades and fails the run when all selected advisory sources are unavailable.
- Audit terminal output now shows advisory-source health directly in table and summary modes, so degraded coverage is visible without reading JSON.
- Resolved TypeScript JSX compiler errors by properly exposing `"jsx": "react-jsx"` in `tsconfig.json`.

---

## [0.5.2] - 2026-02-27

### Added

- **New `unused` command**: Detect unused and missing npm dependencies by statically scanning source files.
  - Walks `src/` (configurable via `--src`) and extracts all import/require specifiers (ESM static, ESM dynamic, CJS, re-exports).
  - Cross-references against `package.json` `dependencies`, `devDependencies`, and `optionalDependencies`.
  - Reports two problem classes: `declared-not-imported` (unused bloat) and `imported-not-declared` (missing declarations).
  - `--fix` — removes unused entries from `package.json` atomically (with `--dry-run` preview).
  - `--no-dev` — skip `devDependencies` from the unused scan.
  - `--json-file <path>` — write structured JSON report for CI pipelines.
  - Exit code `1` when unused or missing dependencies are found.

- **New `resolve` command**: Pure-TS in-memory peer dependency conflict detector — **no `npm install` subprocess spawned**.
  - Builds a `PeerGraph` from declared dependencies, enriched with `peerDependencies` fetched in parallel from the registry (cache-first — instant on warm cache, offline-capable).
  - Performs a single-pass O(n × peers) BFS traversal using the new `satisfies()` semver util.
  - Classifies conflicts as `error` (ERESOLVE-level, different major) or `warning` (soft peer incompatibility).
  - Generates human-readable fix suggestions per conflict.
  - `--after-update` — simulates proposed `rup check` updates in-memory _before_ writing anything, showing you peer conflicts before they happen.
  - `--safe` — exits non-zero on any error-level conflict.
  - `--json-file <path>` — write structured JSON conflict report.
  - Exit code `1` when error-level conflicts are detected.

- **New `licenses` command**: SPDX license compliance scanning with SBOM generation.
  - Fetches the `license` field from each dependency's npm packument in parallel.
  - Normalizes raw license strings to SPDX 2.x identifiers.
  - `--allow <spdx,...>` — allowlist mode: flag any package not in the list.
  - `--deny <spdx,...>` — denylist mode: flag any package matching these identifiers.
  - `--sbom <path>` — generate a standards-compliant **SPDX 2.3 JSON SBOM** document (`DESCRIBES` + `DEPENDS_ON` relationship graph, required by CISA/EU CRA mandates).
  - `--json-file <path>` — write full license report as JSON.
  - Exit code `1` when license violations are detected.

- **New `snapshot` command**: Save, list, restore, and diff dependency state snapshots.
  - `rup snapshot save [--label <name>]` — captures `package.json` contents and lockfile hashes for all workspace packages into a lightweight JSON store (`.rup-snapshots.json`).
  - `rup snapshot list` — shows all saved snapshots with timestamp and label.
  - `rup snapshot restore <id|label>` — writes back captured `package.json` files atomically; prompts to re-run the package manager install.
  - `rup snapshot diff <id|label>` — shows dependency version changes since the snapshot.
  - JSON-file store (no SQLite dependency), human-readable and git-committable.
  - `--store <path>` — custom store file location.

- **Impact Score engine** (`src/core/impact.ts`): Per-update risk assessment.
  - Computes a 0–100 composite score: `diffTypeWeight` (patch=10, minor=25, major=55) + CVE presence bonus (+35) + workspace spread (up to +20).
  - Ranks each update as `critical`, `high`, `medium`, or `low`.
  - `applyImpactScores()` batch helper for the check/upgrade pipeline.
  - ANSI `impactBadge()` for terminal table rendering (wired to `--show-impact` flag, coming in a follow-up).

- **`satisfies(version, range)` utility** (`src/utils/semver.ts`): Pure-TS semver range checker.
  - Handles `^`, `~`, `>=`, `<=`, `>`, `<`, exact, `*`/empty (always true).
  - Supports compound AND ranges (`>=1.0.0 <2.0.0`) and OR union ranges (`^16 || ^18`).
  - Falls through gracefully on non-semver inputs (e.g., `workspace:*`, `latest`) — no false-positive conflicts.
  - Used by `rup resolve` peer graph resolver.

### Architecture

- `unused`, `resolve`, `licenses`, and `snapshot` are fully isolated modules under `src/commands/`. All are lazy-loaded (dynamic `import()`) on first invocation — zero startup cost penalty.
- `src/core/options.ts` dispatches all 4 new commands to their isolated sub-parsers. `KNOWN_COMMANDS` now contains **13 entries**.
- `ParsedCliArgs` union extended with 4 new command variants.
- `src/types/index.ts` extended with: `ImpactScore`, `PeerNode`, `PeerGraph`, `PeerConflict`, `PeerConflictSeverity`, `UnusedKind`, `UnusedDependency`, `UnusedOptions`, `UnusedResult`, `PackageLicense`, `SbomDocument`, `SbomPackage`, `SbomRelationship`, `LicenseOptions`, `LicenseResult`, `SnapshotEntry`, `SnapshotAction`, `SnapshotOptions`, `SnapshotResult`, `ResolveOptions`, `ResolveResult`.
- `PackageUpdate` extended with optional `impactScore?: ImpactScore` and `homepage?: string` fields.

### Changed

- CLI global help updated to list all **13 commands** including `unused`, `resolve`, `licenses`, and `snapshot`.
- `src/bin/cli.ts` exit codes: `unused` exits `1` on any unused/missing dep; `resolve` exits `1` on error-level peer conflicts; `licenses` exits `1` on violations; `snapshot` exits `1` on store errors.

---

## [0.5.1] - 2026-02-27

### Added

- **New `audit` command**: Scan dependencies for known CVEs using [OSV.dev](https://osv.dev) (Google's open vulnerability database). Runs queries in parallel for all installed packages.
  - `--severity critical|high|medium|low` — Filter by minimum severity level
  - `--fix` — Print the minimum-secure-version `npm install` command to patch advisories
  - `--dry-run` — Preview without side effects
  - `--report json` — Machine-readable JSON output
  - `--json-file <path>` — Write JSON report to file for CI pipelines
  - Exit code `1` when vulnerabilities are found; `0` when clean.

- **New `health` command**: Surface stale, deprecated, and unmaintained packages before they become liabilities.
  - `--stale 12m|180d|365` — Flag packages with no release in the given period (supports months and days)
  - `--deprecated` / `--no-deprecated` — Control deprecated package detection
  - `--alternatives` — Suggest active alternatives for deprecated packages
  - `--report json` — Machine-readable JSON output
  - Exit code `1` when flagged packages are found.

- **New `bisect` command**: Binary search across semver versions to find the exact version that introduced a failing test or breaking change.
  - `rup bisect <package> --cmd "<test command>"` — Specify test oracle command
  - `--range <start>..<end>` — Narrow the search to a specific version range
  - `--dry-run` — Simulate without installing anything
  - Exit code `1` when a breaking version is identified.

- **New CLI binary aliases for developer ergonomics**:
  - `rup` — Ultra-short power-user alias (e.g., `rup ci`, `rup audit`)
  - `rainy-up` — Human-friendly alias (e.g., `rainy-up check`)
  - `rainy-updates` retained for backwards compatibility with CI scripts.

### Architecture

- `bisect`, `audit`, and `health` are fully isolated modules under `src/commands/`. They are lazy-loaded (dynamic `import()`) only when their command is invoked — zero startup cost penalty.
- `src/core/options.ts` now dispatches `bisect`, `audit`, and `health` to their isolated sub-parsers, keeping the command router clean and extensible.
- New type definitions: `AuditOptions`, `AuditResult`, `CveAdvisory`, `BisectOptions`, `BisectResult`, `HealthOptions`, `HealthResult`, `PackageHealthMetric`.

### Changed

- CLI global help updated to list all 9 commands.
- Error messages now include `(rup)` in the binary identifier.
- `package.json` description updated to reflect DevOps-first positioning.

## [0.5.1-rc.4] - 2026-02-27

### Added

- New registry and stream controls:
  - `--registry-timeout-ms <n>`
  - `--registry-retries <n>`
  - `--stream`
- New lockfile execution control:
  - `--lockfile-mode preserve|update|error`
- Policy extensions:
  - package rule `target` override
  - package rule `autofix` control for fix-PR flows
- New additive summary/output metadata:
  - `streamedEvents`
  - `policyOverridesApplied`
  - `registryAuthFailure`
  - `streamed_events` GitHub output key
  - `policy_overrides_applied` GitHub output key
  - `registry_auth_failures` GitHub output key

### Changed

- Registry client now supports configurable retry count and timeout defaults.
- Registry resolution now supports `.npmrc` auth token/basic auth parsing for scoped/private registries.
- Fix-PR automation now excludes updates with `autofix: false`.
- CI workflow templates generated by `init-ci` now include stream mode and registry control flags.
- Upgrade flow now enforces explicit lockfile policy semantics via `--lockfile-mode`.

### Tests

- Extended options parsing tests for registry/stream/lockfile flags.
- Extended policy tests for `target` and `autofix` rule behavior.
- Updated output and summary tests for additive metadata fields.

## [0.5.1-rc.3] - 2026-02-27

### Fixed

- Resolved false dirty-worktree failures in `--fix-pr` flows caused by early PR report file creation.
- `deps-report.md` generation now runs after fix-PR git automation checks/operations.

## [0.5.1-rc.2] - 2026-02-27

### Added

- CI fix-PR batch automation:
  - `ci --fix-pr` now creates batched branches from a shared base ref using git worktrees.
  - New flag: `--fix-pr-batch-size <n>` to control groups per branch batch.
- New summary/output metadata:
  - `fixPrBranchesCreated`
  - `fix_pr_branches_created` GitHub output key.

### Changed

- `ci --fix-pr --group-by scope` now supports multi-branch batch creation for scoped dependency flows.
- `runCi` now consistently performs CI analysis flow first, with fix-PR handled by dedicated batch automation.

### Tests

- Added batch planning tests for fix-PR branch creation.
- Extended parser tests for `--fix-pr-batch-size`.

## [0.5.1-rc.1] - 2026-02-27

### Added

- New `ci` command for CI-first orchestration:
  - profile-driven automation with `--mode minimal|strict|enterprise`,
  - warm-cache + check/upgrade flow with deterministic artifacts.
- New rollout and orchestration flags:
  - `--group-by none|name|scope|kind|risk`
  - `--group-max <n>`
  - `--cooldown-days <n>`
  - `--pr-limit <n>`
  - `--only-changed`
- Additive summary/output contract fields:
  - `groupedUpdates`
  - `cooldownSkipped`
  - `ciProfile`
  - `prLimitHit`
- Policy schema extensions:
  - global `cooldownDays`
  - package rule `group` and `priority`

### Changed

- `check` now supports cooldown-aware filtering when publish timestamps are available.
- CI workflow templates generated by `init-ci` now use `rainy-updates ci` with explicit profile mode.
- GitHub output, metrics output, SARIF properties, and PR report include new CI orchestration metadata.

### Tests

- Added parser coverage for `ci` command orchestration flags.
- Extended workflow, policy, summary, and output tests for new metadata and profile behavior.

## [0.5.0] - 2026-02-27

### Changed

- Promoted `0.5.0-rc.4` to General Availability.
- Stabilized deterministic CI artifact behavior for JSON, SARIF, and GitHub outputs.
- Finalized fix-PR summary metadata contract defaults for automation pipelines.

### Added

- GA release gate includes `perf:smoke` CI check for regression protection.

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
