# Contributing

## Development

```bash
bun install
bun run check
bun run build
```

## Production readiness checks

```bash
bun run prepublishOnly
```

## Release process

1. Update `CHANGELOG.md`.
2. Bump `package.json` version.
3. Run `bun run prepublishOnly`.
4. Create and push tag `vX.Y.Z`.
5. GitHub Actions publish workflow will publish to npm when `NPM_TOKEN` is configured.

## Security

If you discover a security issue, open a private security advisory in GitHub.
