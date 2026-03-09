# Local Automation (`init-ci --target`)

`init-ci` now supports local scheduler targets in addition to GitHub Actions:

- `--target github` (default)
- `--target cron`
- `--target systemd`

## Cron

Generate cron automation files:

```bash
rup init-ci --target cron --mode strict --schedule daily --force
```

Generated files:

- `.artifacts/automation/rainy-updates-runner.sh`
- `.artifacts/automation/rainy-updates.cron`

Install locally:

```bash
crontab .artifacts/automation/rainy-updates.cron
```

## systemd timer

Generate systemd files:

```bash
rup init-ci --target systemd --mode strict --schedule weekly --force
```

Generated files:

- `.artifacts/automation/rainy-updates-runner.sh`
- `.artifacts/automation/rainy-updates.service`
- `.artifacts/automation/rainy-updates.timer`

Example setup on Linux:

```bash
sudo cp .artifacts/automation/rainy-updates.service /etc/systemd/system/
sudo cp .artifacts/automation/rainy-updates.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rainy-updates.timer
```

## Why external scheduler

As of March 2026, Bun documents timer primitives (`setTimeout`, `setInterval`, `Bun.sleep`) but not a native public cron scheduler API. Local cron/systemd keeps automation deterministic and production-like.
