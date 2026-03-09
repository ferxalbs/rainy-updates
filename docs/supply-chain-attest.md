# Supply-chain + Attest

`v0.7.0` extends Rainy Updates beyond package-manager checks with two new commands:

- `rup supply-chain` scans cross-stack surfaces: Docker images, GitHub Actions, Terraform providers, and Helm dependencies.
- `rup attest` verifies release provenance/signing posture and returns a policy verdict (`allow|review|block`).

## `rup supply-chain`

```bash
rup supply-chain --scope all --format table
rup supply-chain --scope docker,actions --format json --json-file .artifacts/supply-chain.json
```

### Scanners in v1

- Docker: `FROM ...` image pinning quality (digest vs mutable tags).
- GitHub Actions: `uses: owner/repo@ref` immutability checks (SHA pinning recommended).
- Terraform: `required_providers` source + version constraint strictness.
- Helm: `Chart.yaml` dependency version pinning quality.

### Output model

Findings are normalized to the same semantics used in review workflows:

- `riskLevel`
- `policyAction`
- `recommendedAction`

## `rup attest`

```bash
rup attest --action verify --format table
rup attest --action report --no-require-signing --format json --json-file .artifacts/attest.json
```

### Default checks

- `publish-provenance`: validates `package.json -> publishConfig.provenance=true`
- `sbom-present`: checks for SBOM/report artifacts in standard paths
- `workflow-signing`: checks workflows for signing/provenance automation markers
- `checksums-present`: checks release checksum artifact presence
- `decision-artifact`: checks deterministic plan artifact presence

### Policy behavior

- Any failed required check => `policyAction=block`
- No failures, at least one warning => `policyAction=review`
- All checks pass => `policyAction=allow`
