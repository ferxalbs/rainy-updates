# Risk Engine

Rainy Updates distinguishes three kinds of dependency concern:

- `known-vulnerability`
- `behavioral-risk`
- `operational-health`

## Current scoring inputs

- known vulnerabilities
- install lifecycle scripts
- typosquatting heuristic
- newly published packages
- suspicious metadata
- mutable git/http dependencies
- maintainer stability heuristic
- peer conflicts
- license violations
- stale or deprecated health signals
- major version jumps

## Output shape

The risk engine produces:

- `riskScore`
- `riskLevel`
- `riskReasons`
- `riskCategories`
- `recommendedAction`

## Important note on maintainer churn

The current `v0.5.2.a` line uses a lightweight registry-backed heuristic.
If the registry does not expose enough data, the signal is reported as `unknown` instead of pretending to be authoritative.
