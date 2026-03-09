# Command Model

Rainy Updates has one intended lifecycle:

1. `check` detects
2. `doctor` summarizes
3. `predict` estimates break risk
4. `review` decides
5. `upgrade` applies

## `check`

Use `check` when you want a fast candidate list.

- It should stay fast.
- It should tell you what changed.
- It is not the final decision surface.

## `doctor`

Use `doctor` when you need a quick verdict.

- It compresses the situation into a short summary.
- It should point you to `review` when action is needed.

## `review`

`review` is the center of the product.

- security
- behavioral risk
- operational health
- peer conflicts
- license policy
- package selection

If you need to decide, use `review`.

## `predict`

Use `predict` when you need a risk forecast before mutation.

- package mode: `rup predict <package>`
- workspace mode: `rup predict --workspace`
- plan mode: `rup predict --from-plan .artifacts/decision-plan.json`

## `upgrade`

Use `upgrade` after review.

- It applies the approved change set.
- Interactive upgrade should still feel like review first, apply second.

## Cross-stack extension (`v0.7.0`)

Use these commands to extend beyond package-manager-only review:

- `supply-chain`: scans Docker, GitHub Actions, Terraform, and Helm risk posture using the same policy semantics (`riskLevel`, `policyAction`, `recommendedAction`).
- `attest`: verifies provenance/signing/SBOM posture and returns a release policy verdict (`allow|review|block`).
