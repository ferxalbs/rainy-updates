# Contributing

Thanks for contributing to `@rainy-updates/cli`.

## Development setup

```bash
bun install
```

## Local quality gates

```bash
bun run check
bun run build
bun run test:prod
```

`check` runs typecheck + tests. `test:prod` validates built CLI behavior (`--help`, `--version`).

## Implementation standards

- Keep CLI behavior backward compatible unless intentionally versioned.
- Preserve deterministic exit codes:
  - `0` success
  - `1` CI update-detected condition
  - `2` operational/runtime error
- Add tests for any new flag, command, or output contract.
- Keep machine outputs stable (`json`, `sarif`, GitHub output, PR report).

## Docs standards

When changing behavior, update:

- `README.md` (user-facing usage and capabilities)
- `CHANGELOG.md` (release-facing change summary)
- `SECURITY.md` if security posture/reporting changes

## Release process

1. Update `CHANGELOG.md`.
2. Bump `package.json` version.
3. Run:

```bash
bun run prepublishOnly
```

4. Push commit and tag (`vX.Y.Z`).
5. Release workflow publishes to npm.

## Security

Do not disclose vulnerabilities publicly before responsible disclosure.
Use GitHub Security Advisories for private reporting.
