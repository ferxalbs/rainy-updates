# Enterprise Use Case: `@rainy-updates/cli`

## Purpose

This document defines how enterprise teams should use `@rainy-updates/cli` to run dependency governance as a deterministic CI control flow, not just an ad-hoc updater.

## Target outcomes

- Keep dependency updates continuously visible across monorepos.
- Reduce update blast radius using rollout gates (`--fail-on`, `--max-updates`, `--pr-limit`).
- Enforce predictable release behavior with deterministic machine artifacts.
- Support security/compliance review with SARIF, JSON, and PR markdown reports.

## Typical enterprise architecture

- Monorepo with npm or pnpm workspaces.
- Protected default branch (PR-only merges).
- Scheduled dependency checks via GitHub Actions.
- Artifact retention for audit and triage.

## Recommended command profile

### 1) Weekly dependency governance run

```bash
npx @rainy-updates/cli ci \
  --workspace \
  --mode enterprise \
  --concurrency 32 \
  --group-by scope \
  --group-max 200 \
  --cooldown-days 7 \
  --pr-limit 50 \
  --fail-on minor \
  --max-updates 50 \
  --format github \
  --json-file .artifacts/deps-report.json \
  --pr-report-file .artifacts/deps-report.md \
  --sarif-file .artifacts/deps-report.sarif \
  --github-output $GITHUB_OUTPUT
```

### 2) Automated fix branch flow

```bash
npx @rainy-updates/cli ci \
  --workspace \
  --mode strict \
  --fix-pr \
  --fix-branch chore/rainy-updates \
  --fix-commit-message "chore(deps): apply rainy-updates"
```

## Policy model guidance

Use `.rainyupdates-policy.json` to codify package-level controls.

```json
{
  "cooldownDays": 14,
  "ignore": ["@types/*"],
  "packageRules": {
    "react": {
      "maxTarget": "minor",
      "group": "frontend",
      "priority": 10
    },
    "typescript": {
      "ignore": true
    }
  }
}
```

## CI contract expectations

The command emits deterministic metadata suitable for enterprise pipelines:

- `summary.groupedUpdates`
- `summary.cooldownSkipped`
- `summary.ciProfile`
- `summary.prLimitHit`
- `summary.failReason`

These values are also propagated to GitHub outputs and SARIF properties.

## Rollout strategy for enterprise adoption

1. Start in report-only mode (`--fail-on none`) for 1-2 weeks.
2. Enable severity gating (`--fail-on minor`) once noise is tuned.
3. Add fix-branch automation (`--fix-pr`) for patch/minor streams.
4. Tighten policy rules and cooldown windows by package risk class.

## Operational guardrails

- Use `--only-changed` for low-noise human logs.
- Keep `--cooldown-days` enabled to avoid fresh-release churn.
- Cap volume with both `--max-updates` and `--pr-limit`.
- Keep SARIF + JSON artifacts for incident and audit history.

## Release readiness checklist

- `bun run check`
- `bun run build`
- `bun run perf:smoke`
- Validate generated workflow via `init-ci --mode enterprise`
- Confirm PR report and SARIF are uploaded in CI
