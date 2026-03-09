# Reachability + Exceptions

`v0.6.50` introduces two connected capabilities:

- `rup reachability`: adds exploitability context (`reachable|not-reachable|unknown`) to CVE findings.
- `rup exceptions`: stores VEX-like exception records with owner, evidence, status, and expiration.

## Reachability

Run workspace reachability with JSON output:

```bash
rup reachability --workspace --format json --json-file .artifacts/reachability.json
```

Optional severity focus:

```bash
rup reachability --workspace --severity high --format summary
```

### Reachability output model

Each finding includes:

- `packageName`, `cveId`, `severity`
- `status`: `reachable`, `not-reachable`, or `unknown`
- `confidence`: 0..1
- `entrypoints`: workspace package paths where imports were observed
- `evidence`: human-readable reason
- `suppressed`: whether an active exception matched

## Exceptions

Add an exception:

```bash
rup exceptions add \
  --package lodash \
  --cve CVE-2026-0001 \
  --reason "runtime path is isolated" \
  --owner "platform-security" \
  --evidence "static import graph #42" \
  --status accepted_risk \
  --expires-at 2026-06-01T00:00:00.000Z
```

List active entries:

```bash
rup exceptions list --active-only
```

Validate exception hygiene:

```bash
rup exceptions validate --strict
```

### Exception statuses

- `not_affected`
- `affected`
- `fixed`
- `mitigated`
- `accepted_risk`

Exceptions are stored in `.rainy/exceptions.json` by default.

## CI behavior

`review/doctor/ci --gate review` consume reachability + exceptions signals.

- Active exception: item is downgraded to monitored state.
- Advisory with `reachable|unknown` and no exception: remains actionable/reviewable.
- `not-reachable`: de-prioritized but still visible in output.
