# Repository Guidelines

## Project Structure & Module Organization

Core source lives in `src/`. Entry points are under `src/bin/`, shared orchestration is in `src/core/`, command implementations are in `src/commands/`, and cross-cutting utilities live in `src/utils/`, `src/workspace/`, `src/pm/`, and `src/git/`. Generated version metadata is stored in `src/generated/version.ts`. Tests live in `tests/` and generally mirror feature areas (`options.test.ts`, `workspace-scope.test.ts`, `hook.test.ts`). Build output goes to `dist/`. Supporting scripts are in `scripts/`, and longer design or roadmap documents are in the repository root and `docs/`.

## Build, Test, and Development Commands

- `bun run build`: syncs the generated version file and compiles the TypeScript CLI to `dist/`.
- `bun run build:exe`: builds the standalone compiled Bun binary at `dist/rup`.
- `bun test`: runs the full test suite with `bun:test`.
- `pnpm -s exec tsc --noEmit`: strict typecheck without emitting files.
- `bun run test:prod`: validates the built JS CLI and compiled binary entrypoints.
- `bun run prepublishOnly`: full release gate used before publishing.

## Coding Style & Naming Conventions

Use TypeScript with ESM modules and 2-space indentation. Prefer small focused modules over large multi-purpose files. Use `camelCase` for functions and variables, `PascalCase` for types/interfaces, and kebab-style filenames only where already established by command folders. Keep CLI-facing text explicit and operational. Use `apply_patch` for file edits and keep generated files, especially `src/generated/version.ts`, in sync with `package.json`.

## Testing Guidelines

Tests use `bun:test`. Add or update targeted tests for any parser, command runner, or workspace/package-manager behavior you change. Name tests by behavior, not implementation detail, for example `pm-detect.test.ts` or `workspace-scope.test.ts`. Before opening a PR, run at least `pnpm -s exec tsc --noEmit` and `bun test`; for release-sensitive changes also run `bun run test:prod`.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit style: `feat(scope): ...`, `refactor(cli): ...`, `chore(release): ...`. Keep commits scoped and descriptive. PRs should summarize the user-visible change, note any CLI flags or workflow changes, and include validation commands run. If you modify interactive or hook behavior, include the exact command path tested.

## Release & Configuration Notes

This project is Bun-first but must keep the published JS entrypoint functional under Node-based launchers. If you change versioning, run `bun run version:sync`. If you touch publish flow, re-run `bun run prepublishOnly` before release.
