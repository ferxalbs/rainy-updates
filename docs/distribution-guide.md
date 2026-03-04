# Distribution Guide

Rainy Updates can be distributed through three independent channels:

- npm
- GitHub Releases with standalone binaries
- external package-manager metadata built from those GitHub Release assets

The package-manager path for this project is:

- Homebrew tap for macOS and Linux users
- Scoop bucket for Windows users

## Publisher accounts: what you actually need

You do **not** usually need a special publisher account inside Homebrew or Scoop.

What you need is:

- a GitHub account
- a public GitHub repo for your Homebrew tap
- a public GitHub repo for your Scoop bucket

That is the standard maintainer model for independent CLI tools.

## Release source of truth

For Rainy, the source of truth should be the GitHub Release created from the tag.

That release now contains:

- Linux, macOS, and Windows binary archives
- SHA-256 checksum files
- generated Homebrew formula
- generated Scoop manifest

That means:

- npm is one install path
- GitHub Releases are the binary source of truth
- Homebrew and Scoop consume those GitHub Release assets

## Recommended repository setup

Use these repositories:

- source repo: `ferxalbs/rainy-updates`
- tap repo: `ferxalbs/homebrew-rainy-updates`
- bucket repo: `ferxalbs/scoop-rainy-updates`

This separation is the safest operational model.

## Homebrew

### Create the tap repository

Recommended repo name:

- `homebrew-rainy-updates`

Recommended tap namespace:

- `ferxalbs/rainy-updates`

### Create the tap

On a machine with Homebrew and GitHub CLI:

```bash
brew tap-new ferxalbs/rainy-updates
gh repo create ferxalbs/homebrew-rainy-updates \
  --public \
  --source "$(brew --repository ferxalbs/rainy-updates)" \
  --push
```

### Formula location

Put the generated formula here:

```text
Formula/rup.rb
```

### Formula source

After the release workflow runs, use the generated `rup.rb` from the GitHub Release artifacts or from:

```text
dist/github-release/manifests/homebrew/rup.rb
```

### User install command

```bash
brew install ferxalbs/rainy-updates/rup
```

### Update flow for each release

1. push the release tag in the main repo
2. wait for `Release Binaries` to finish
3. copy the generated `rup.rb`
4. commit it to `homebrew-rainy-updates`
5. users can upgrade with `brew upgrade rup`

## Scoop

### Create the bucket repository

Recommended repo name:

- `scoop-rainy-updates`

### Bucket structure

Use:

```text
bucket/rup.json
```

### Manifest source

After the release workflow runs, use the generated `rup.json` from the GitHub Release artifacts or from:

```text
dist/github-release/manifests/scoop/rup.json
```

### User install commands

```powershell
scoop bucket add rainy-updates https://github.com/ferxalbs/scoop-rainy-updates
scoop install rainy-updates/rup
```

### Update flow for each release

1. push the release tag in the main repo
2. wait for `Release Binaries` to finish
3. copy the generated `rup.json`
4. commit it to `scoop-rainy-updates`
5. users can upgrade with `scoop update rup`

## Local generation

If you need to generate the manifests locally after building release assets:

```bash
bun run generate:distribution-manifests --version 0.6.2
```

By default this reads checksums from:

```text
dist/assets/
```

And writes:

```text
dist/distribution/homebrew/rup.rb
dist/distribution/scoop/rup.json
```

You can override locations with:

```bash
bun scripts/generate-distribution-manifests.mjs \
  --version 0.6.2 \
  --repo ferxalbs/rainy-updates \
  --assets-dir dist/assets \
  --output-dir dist/distribution
```

## Launch order I recommend

1. publish `v0.6.2`
2. let npm publish happen
3. let GitHub binary assets publish
4. copy the generated Homebrew formula into your tap repo
5. copy the generated Scoop manifest into your bucket repo
6. test install on:
   - macOS
   - Linux
   - Windows

## Official references

- Homebrew tap guide: https://docs.brew.sh/How-to-Create-and-Maintain-a-Tap
- Homebrew taps overview: https://docs.brew.sh/Taps
- Homebrew formula policy: https://docs.brew.sh/Acceptable-Formulae
- Scoop buckets: https://github.com/ScoopInstaller/Scoop/wiki/Buckets
- Scoop manifest guide: https://github.com/ScoopInstaller/Scoop/wiki/Creating-an-app-manifest
- Scoop manifest reference: https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests
