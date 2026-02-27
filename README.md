# @rainy-updates/cli

Agentic CLI for dependency updates focused on CI speed and control.

## Install

```bash
npm i -D @rainy-updates/cli
```

## Usage

```bash
npx rainy-updates check --ci --format json
npx rainy-updates upgrade --target latest --install
```

## Commands

- `check`: detect available updates.
- `upgrade`: rewrite `package.json` ranges; optional `--install` runs `npm/pnpm install`.

## Options

- `--target patch|minor|major|latest`
- `--filter <pattern>`
- `--reject <pattern>`
- `--format table|json|minimal`
- `--cache-ttl <seconds>`
- `--ci` (exit code 1 when updates are found)
- `--cwd <path>`
- `--install` (upgrade only)
- `--pm auto|npm|pnpm` (upgrade only)
