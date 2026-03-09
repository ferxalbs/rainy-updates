# Health Badges

This guide makes repository health badges reproducible for any user of `@rainy-updates/cli`.

## Quick start

1. Generate workflow + README snippet:

```bash
rup badge init --owner <github-owner> --repo <repo-name> --readme
```

2. Print final endpoint and markdown only:

```bash
rup badge url --owner <github-owner> --repo <repo-name>
```

3. Copy the universal snippet file:

```bash
cat .artifacts/badges/README-badge-snippet.md
```

## What `rup badge init` creates

- `.github/workflows/health-badge.yml`
- `.artifacts/badges/README-badge-snippet.md`
- Optional README block when `--readme` is provided.

The workflow publishes `.public/badges/health.json` using GitHub Pages (`actions/deploy-pages`).

## Badge URL model

Project pages:

```text
https://<owner>.github.io/<repo>/badges/health.json
```

User/org pages repository (`<owner>.github.io`):

```text
https://<owner>.github.io/badges/health.json
```

Shields endpoint:

```text
https://img.shields.io/endpoint?url=<url-encoded-badge-json-url>
```

## Recommended command matrix

- `rup badge init --owner <owner> --repo <repo> --readme`
- `rup badge init --force` to overwrite existing workflow
- `rup badge url --format json --json-file .artifacts/badges/url.json` for machine pipelines

## Notes

- Ensure GitHub Pages is set to **GitHub Actions** in repository settings.
- Badge JSON is produced by `rup doctor --badge-file`.
- Keep the published file path stable (`badges/health.json`) to avoid README churn.
