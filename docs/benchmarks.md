# Benchmarks

Rainy Updates should be measured with explicit methodology, not vague claims.

## Fixture families

Fixtures are generated with:

```bash
bun run bench:fixtures
```

Current fixture labels represent dependency manifest entry counts:

- `single-100`
- `single-500`
- `mono-1000`

## Scenarios

Run benchmark scenarios with:

```bash
bun run bench:check
bun run bench:review
bun run bench:resolve
bun run bench:ci
```

Each scenario runs multiple samples and reports:

- fixture
- command
- cache state
- per-run timings
- median time
- warmup status (`ready`, `not-requested`, or `skipped`)
- execution status (`ready` or `skipped`)
- skip flag when warm cache could not be established

## Reading a result

- A measured run has `execution.status = "ready"` and includes timings plus a median.
- A skipped warm run means the benchmark could not establish a warm cache because registry access was unavailable in the current environment.
- A skipped cold run means the measured command itself could not reach the registry, so no timing claim should be published for that environment.
- Skipped runs are environmental observations, not product failures.

## Methodology

When publishing benchmark results, always include:

- machine and CPU
- Node version
- Bun version
- fixture name
- cache state (`cold` or `warm`)
- exact command
- number of runs
- median result
- whether warmup or measured execution was skipped because the registry was unavailable

## Notes

- `perf:smoke` is the regression gate.
- `bench:*` scripts are for public methodology and comparative analysis.
- Warm-cache numbers should be reported separately from cold-cache numbers.
- Analytical commands can exit `1` when they find updates or policy issues; benchmark scripts treat those as valid measured runs.
- Warm-cache and measured benchmark runs are skipped instead of faked when registry access is unavailable in the current environment.
