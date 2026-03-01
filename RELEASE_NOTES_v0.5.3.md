# v0.5.3

GA stabilization and review-centered workflow refinement.

## What changed for users

`v0.5.3` turns the current Rainy Updates line into a clearer dependency operating model:

- `check` detects
- `doctor` summarizes
- `review` decides
- `upgrade` applies

That hierarchy is now reflected across the CLI, docs, and TUI, so the product reads as one workflow instead of a collection of disconnected commands.

## Core release themes

### Formal risk engine

Rainy Updates now ships with a dedicated risk engine under `src/risk/`.
It scores dependency candidates with deterministic signals such as:

- known vulnerabilities
- install lifecycle scripts
- typosquatting heuristics
- newly published packages
- suspicious metadata
- mutable git/http sources
- maintainer-stability heuristics
- peer conflicts
- license-policy blockers

The engine keeps incomplete signals conservative. For example, missing maintainer coverage is treated as `unknown`, not fabricated into a heavy penalty.

### Review-centered workflow

`review` is now the decision surface for the product.
`doctor` points operators back into `review` when action is still required, and it no longer presents partial or degraded execution as effectively clean.

### Benchmark methodology

This release adds reproducible benchmark tooling and fixture generation so speed claims can be published with method instead of anecdotes.

- benchmark fixtures live under `benchmarks/fixtures`
- methodology is documented in `docs/benchmarks.md`
- skipped runs are reported explicitly when registry access is unavailable

### Stronger output confidence

Machine-readable and terminal outputs were tightened so additive risk metadata is exposed consistently across:

- JSON
- GitHub outputs
- SARIF
- minimal output

This release also fixes a misleading edge case where minimal output could previously say `No updates found.` during a degraded error path.

## Why this release matters

`v0.5.3` closes the `0.5.x` line with a more serious product shape:

- dependency review is more explicit
- risk scoring is more structured
- CI outputs are more trustworthy
- benchmarks are easier to reproduce and explain

This is not a scope reset for `0.6.x`. It is a cleaner, more defensible closing release for the current line.
