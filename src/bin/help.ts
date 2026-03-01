export function renderHelp(command?: string): string {
  const isCommand = command && !command.startsWith("-");
  if (isCommand && command === "check") {
    return `rainy-updates check [options]

Detect candidate dependency updates. This is the first step in the flow:
  check detects
  doctor summarizes
  review decides
  upgrade applies

Options:
  --workspace
  --target patch|minor|major|latest
  --filter <pattern>
  --reject <pattern>
  --dep-kinds deps,dev,optional,peer
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --cache-ttl <seconds>
  --stream
  --policy-file <path>
  --offline
  --fix-pr
  --fix-branch <name>
  --fix-commit-message <text>
  --fix-dry-run
  --fix-pr-no-checkout
  --fix-pr-batch-size <n>
  --no-pr-report
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>
  --fail-on none|patch|minor|major|any
  --max-updates <n>
  --group-by none|name|scope|kind|risk
  --group-max <n>
  --cooldown-days <n>
  --pr-limit <n>
  --only-changed
  --interactive
  --plan-file <path>
  --show-impact
  --show-links
  --show-homepage
  --lockfile-mode preserve|update|error
  --log-level error|warn|info|debug
  --ci`;
  }

  if (isCommand && command === "warm-cache") {
    return `rainy-updates warm-cache [options]

Pre-warm local metadata cache for faster CI checks.

Options:
  --workspace
  --target patch|minor|major|latest
  --filter <pattern>
  --reject <pattern>
  --dep-kinds deps,dev,optional,peer
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --cache-ttl <seconds>
  --offline
  --stream
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>`;
  }

  if (isCommand && command === "upgrade") {
    return `rainy-updates upgrade [options]

Apply an approved change set to package.json manifests.

Options:
  --workspace
  --sync
  --install
  --pm auto|npm|pnpm
  --target patch|minor|major|latest
  --policy-file <path>
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --fix-pr
  --fix-branch <name>
  --fix-commit-message <text>
  --fix-dry-run
  --fix-pr-no-checkout
  --fix-pr-batch-size <n>
  --interactive
  --plan-file <path>
  --lockfile-mode preserve|update|error
  --no-pr-report
  --json-file <path>
  --pr-report-file <path>`;
  }

  if (isCommand && command === "ci") {
    return `rainy-updates ci [options]

Run CI-oriented automation around the same lifecycle:
  check detects
  doctor summarizes
  review decides
  upgrade applies

Options:
  --workspace
  --mode minimal|strict|enterprise
  --group-by none|name|scope|kind|risk
  --group-max <n>
  --cooldown-days <n>
  --pr-limit <n>
  --only-changed
  --offline
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --stream
  --fix-pr
  --fix-branch <name>
  --fix-commit-message <text>
  --fix-dry-run
  --fix-pr-no-checkout
  --fix-pr-batch-size <n>
  --no-pr-report
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>
  --fail-on none|patch|minor|major|any
  --max-updates <n>
  --lockfile-mode preserve|update|error
  --log-level error|warn|info|debug
  --ci`;
  }

  if (isCommand && command === "init-ci") {
    return `rainy-updates init-ci [options]

Create a GitHub Actions workflow template at:
  .github/workflows/rainy-updates.yml

Options:
  --force
  --mode minimal|strict|enterprise
  --schedule weekly|daily|off`;
  }

  if (isCommand && command === "baseline") {
    return `rainy-updates baseline [options]

Save or compare dependency baseline snapshots.

Options:
  --save
  --check
  --file <path>
  --workspace
  --dep-kinds deps,dev,optional,peer
  --ci`;
  }

  if (isCommand && command === "audit") {
    return `rainy-updates audit [options]

Scan dependencies for CVEs using OSV.dev and GitHub Advisory Database.

Options:
  --workspace
  --severity critical|high|medium|low
  --summary
  --report table|summary|json
  --source auto|osv|github|all
  --fix
  --dry-run
  --commit
  --pm auto|npm|pnpm|bun|yarn
  --json-file <path>
  --concurrency <n>
  --registry-timeout-ms <n>`;
  }

  if (isCommand && command === "review") {
    return `rainy-updates review [options]

Review is the decision center of Rainy Updates.
Use it to inspect risk, security, peer, license, and policy context before applying changes.

Options:
  --workspace
  --interactive
  --security-only
  --risk critical|high|medium|low
  --diff patch|minor|major|latest
  --apply-selected
  --plan-file <path>
  --show-changelog
  --policy-file <path>
  --json-file <path>
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>`;
  }

  if (isCommand && command === "doctor") {
    return `rainy-updates doctor [options]

Produce a fast summary verdict and point the operator to review when action is needed.

Options:
  --workspace
  --verdict-only
  --include-changelog
  --json-file <path>`;
  }

  if (isCommand && command === "dashboard") {
    return `rainy-updates dashboard [options]

Open the primary interactive dependency operations console.

Options:
  --workspace
  --mode check|review|upgrade
  --focus all|security|risk|major|blocked|workspace
  --apply-selected
  --plan-file <path>
  --cwd <path>`;
  }

  if (isCommand && command === "ga") {
    return `rainy-updates ga [options]

Audit release and CI readiness for Rainy Updates.

Options:
  --workspace
  --json-file <path>
  --cwd <path>`;
  }

  return `rainy-updates (rup / rainy-up) <command> [options]

Commands:
  check       Detect candidate updates
  doctor      Summarize what matters
  review      Decide what to do
  upgrade     Apply the approved change set
  dashboard   Open the primary interactive dependency dashboard
  ci          Run CI-focused orchestration
  warm-cache  Warm local cache for fast/offline checks
  init-ci     Scaffold GitHub Actions workflow
  baseline    Save/check dependency baseline snapshots
  audit       Scan dependencies for CVEs (OSV.dev + GitHub)
  health      Detect stale/deprecated/unmaintained packages
  bisect      Find which version of a dep introduced a failure
  unused      Detect unused or missing npm dependencies
  resolve     Check peer dependency conflicts (pure-TS, no subprocess)
  licenses    Scan dependency licenses and generate SPDX SBOM
  snapshot    Save, list, restore, and diff dependency state snapshots
  ga          Audit GA and CI readiness for this checkout

Global options:
  --cwd <path>
  --workspace
  --target patch|minor|major|latest
  --format table|json|minimal|github|metrics
  --json-file <path>
  --github-output <path>
  --sarif-file <path>
  --pr-report-file <path>
  --policy-file <path>
  --fail-on none|patch|minor|major|any
  --max-updates <n>
  --group-by none|name|scope|kind|risk
  --group-max <n>
  --cooldown-days <n>
  --pr-limit <n>
  --only-changed
  --interactive
  --show-impact
  --show-links
  --show-homepage
  --mode minimal|strict|enterprise
  --fix-pr
  --fix-branch <name>
  --fix-commit-message <text>
  --fix-dry-run
  --fix-pr-no-checkout
  --fix-pr-batch-size <n>
  --no-pr-report
  --log-level error|warn|info|debug
  --concurrency <n>
  --registry-timeout-ms <n>
  --registry-retries <n>
  --cache-ttl <seconds>
  --offline
  --stream
  --lockfile-mode preserve|update|error
  --ci
  --help, -h
  --version, -v`;
}
