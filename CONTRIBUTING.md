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
4. Ensure `NPM_TOKEN` is set in repository secrets.
5. Create and push tag `vX.Y.Z`.
6. GitHub Actions publish workflow will run preflight + publish.

## npm publishing troubleshooting

If release fails with `404 Not Found` for scoped package or `Access token expired or revoked`:

1. Regenerate npm automation token and update `NPM_TOKEN` secret.
2. Verify token can run `npm whoami`.
3. Ensure package scope ownership:
   - package `@scope/name` can only be first-published by a user/org that owns `@scope`.
   - if scope differs from your npm username, configure org membership and publish permissions.

The release workflow includes `scripts/release-preflight.mjs` to validate auth and package scope before publishing.

## Security

If you discover a security issue, open a private security advisory in GitHub.
