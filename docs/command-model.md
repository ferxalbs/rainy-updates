# Command Model

Rainy Updates has one intended lifecycle:

1. `check` detects
2. `doctor` summarizes
3. `review` decides
4. `upgrade` applies

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

## `upgrade`

Use `upgrade` after review.

- It applies the approved change set.
- Interactive upgrade should still feel like review first, apply second.
