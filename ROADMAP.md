# Roadmap

This roadmap tracks the planned evolution of `@rainy-updates/cli` from production-ready update automation to a full dependency operations platform.

## v0.5.0 (Next)

Focus: CI automation power-up and safer rollout flows.

- Add `init-ci --mode enterprise` template with:
  - dependency check matrix by package manager/runtime,
  - artifact retention policy,
  - stricter permissions by default.
- Add `--fix-pr` workflow mode:
  - create/update branch with manifest changes,
  - generate commit message + PR-ready markdown summary.
- Add policy enhancements:
  - per-group rules (`dependencies`, `devDependencies`, etc.),
  - deny/allow lists by regex,
  - rule priority and overrides.
- Add richer exit policy flags:
  - `--fail-on major|minor|patch|any`,
  - `--max-updates <n>` for controlled CI gates.
- Add baseline snapshots:
  - save current dependency state,
  - compare drift against baseline in CI.

## v0.6.0

Focus: Monorepo intelligence and dependency graph safety.

- Workspace graph upgrades:
  - impact analysis by package,
  - change propagation report,
  - cycle-aware update planner.
- Introduce `plan` command:
  - dry-run execution graph,
  - risk classification per update,
  - export plan as JSON.
- Add lockfile-aware diagnostics for npm/pnpm.
- Improve peer dependency conflict reporting with remediation hints.

## v0.7.0

Focus: Security and governance workflows.

- Security signal integration layer:
  - severity-aware scoring in reports,
  - policy gates by severity/risk threshold.
- Add signed report bundles for CI artifacts.
- Add organization policy packs:
  - reusable presets for teams,
  - centralized configuration inheritance.
- Add SARIF rule expansion and mapping for update risk categories.

## v0.8.0

Focus: Performance and scale.

- Resolver optimizations for very large monorepos.
- Advanced cache strategies:
  - segmented caches,
  - smarter invalidation,
  - optional remote cache adapters.
- Batched registry query optimization and fallback heuristics.
- Improved memory and latency profiling output.

## v0.9.0

Focus: Developer experience and ecosystem integration.

- Plugin API (experimental):
  - custom resolvers,
  - custom policy evaluators,
  - custom output exporters.
- Native integrations for common CI platforms and self-hosted runners.
- Rich terminal UX improvements for long-running operations.

## v1.0.0

Focus: Stable platform release.

- Stability guarantees for CLI and JSON output contracts.
- Backward compatibility policy and deprecation lifecycle.
- Full documentation set for operators and maintainers.
- Long-term support release process for enterprise users.

## Ongoing tracks

- Reliability hardening and regression prevention.
- Faster feedback loops for CI usage at scale.
- Security posture improvements and supply chain integrity.
- Better defaults with zero-config onboarding.
