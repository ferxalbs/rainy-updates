# TUI Guide

The Rainy Updates TUI is a keyboard-first review screen for deciding which dependency updates should move forward.

If it feels unusual at first, that is because it is not a mouse-driven UI. It is closer to a terminal review queue:

- left side: package list
- right side: decision details
- bottom: current selection status

## What the TUI is for

Use the TUI when you want to:

- review risky updates one by one
- keep some updates selected and drop others
- inspect risk, advisories, license status, and health before applying changes

Use:

```bash
rup review --interactive
```

or:

```bash
rup upgrade --interactive
```

`review --interactive` is for deciding.
`upgrade --interactive` is for deciding and then applying the approved set.

## Layout

The TUI has three parts:

### Review Queue

This is the package list on the left.

Each row shows:

- package name
- diff type
- risk level
- decision state
- risk score
- version change

### Decision Panel

This is the details panel on the right.

It shows the currently focused package:

- package path
- state
- diff type
- risk level
- risk score
- impact score
- advisory count
- peer conflict status
- license status
- health status
- recommended action
- homepage
- risk reasons

### Status Bar

This is the bottom line.

It tells you:

- how many packages are selected
- how many total packages are in the queue
- which filter is active

## Controls

The TUI is fully keyboard-driven.

- `Left Arrow`: move to the previous filter
- `Right Arrow`: move to the next filter
- `Up Arrow`: move to the previous package
- `Down Arrow`: move to the next package
- `Space`: toggle the focused package on or off
- `A`: select all currently visible packages
- `N`: clear the current selection
- `Enter`: confirm the current decision set
- `Ctrl+C`: exit without continuing

## Filters

The filter row changes which packages are visible.

- `all`: every review candidate
- `security`: only packages with advisories
- `risky`: only high-risk or critical-risk packages
- `major`: only major-version updates

Filtering does not remove packages from the underlying run.
It only changes what is visible while you decide.

## How to use it in practice

A simple review flow:

1. Run `rup doctor` to see whether you should review.
2. Open `rup review --interactive`.
3. Start with the `security` filter.
4. Move with `Up` and `Down`.
5. Read the right-side panel before leaving a package selected.
6. Use `Space` to remove packages you do not want to approve yet.
7. Press `Enter` when the selected set is correct.

For a more conservative flow:

1. Check `security`
2. Check `risky`
3. Check `major`
4. Return to `all`
5. Confirm only what still looks safe

## Why it can feel strange

The TUI is optimized for terminal speed, not for visual richness.

That means:

- no mouse interaction
- no clickable panels
- no modal popups
- no pointer-based discovery

If you expect a desktop-style interface, it will feel rough.
If you treat it as a fast terminal review queue, it makes more sense.

## Current limitations

Today the TUI is intentionally simple:

- selection is keyboard-only
- details are read-only
- there is no inline search box
- there is no mouse support
- package actions are confirmed as one selected set

## Recommended command model

Use the commands in this order:

1. `rup check`
2. `rup doctor`
3. `rup review --interactive`
4. `rup upgrade --interactive`

That keeps the TUI in its intended role: decision-making, not initial discovery.
