# Review Workflow

Rainy Updates is built around a review-first workflow.

If you are using the interactive terminal UI, read the dedicated guide:

- [TUI Guide](./tui-guide.md)

## Local operator flow

```bash
rup check --workspace --show-impact
rup doctor --workspace
rup review --interactive
rup upgrade --interactive
```

## Why review is the center

`review` combines:

- update candidates
- advisories
- behavioral risk
- peer conflicts
- license status
- package health

That makes it the correct place to decide what to apply.

## Targeted review examples

```bash
rup review --security-only
rup review --risk high
rup review --diff major
```

## CI-oriented triage

```bash
rup doctor --workspace --verdict-only
rup review --security-only --json-file .artifacts/review.json
```
