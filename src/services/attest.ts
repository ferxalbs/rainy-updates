import path from "node:path";
import { readdir } from "node:fs/promises";
import type { AttestCheck, AttestOptions, AttestResult } from "../types/index.js";

const WORKFLOW_GLOBS = [".github/workflows/*.yml", ".github/workflows/*.yaml"];

export async function runAttestService(options: AttestOptions): Promise<AttestResult> {
  const checks: AttestCheck[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    checks.push(await checkPublishProvenance(options));
    checks.push(await checkSbom(options));
    checks.push(await checkWorkflowSigning(options));
    checks.push(await checkChecksums(options));
    checks.push(await checkDecisionArtifact(options));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const hasFailures = checks.some((item) => item.status === "fail");
  const hasWarnings = checks.some((item) => item.status === "warn");

  const policyAction = hasFailures ? "block" : hasWarnings ? "review" : "allow";
  const passed = !hasFailures;
  const recommendedAction = hasFailures
    ? "Block release promotion until failed attestation checks are resolved."
    : hasWarnings
      ? "Proceed with review and capture accepted-risk rationale in CI artifacts."
      : "Attestation posture is healthy for release gating.";

  if (!passed) {
    warnings.push("One or more attestation checks failed.");
  }

  return {
    action: options.action,
    passed,
    policyAction,
    recommendedAction,
    checks,
    errors,
    warnings,
  };
}

async function checkPublishProvenance(options: AttestOptions): Promise<AttestCheck> {
  const packageJson = path.join(options.cwd, "package.json");
  if (!(await Bun.file(packageJson).exists())) {
    return {
      id: "publish-provenance",
      status: options.requireProvenance ? "fail" : "warn",
      message: "package.json not found to evaluate publishConfig.provenance.",
    };
  }

  const manifest = (await Bun.file(packageJson).json()) as {
    publishConfig?: { provenance?: boolean };
  };
  const provenance = manifest.publishConfig?.provenance === true;

  if (provenance) {
    return {
      id: "publish-provenance",
      status: "pass",
      message: "publishConfig.provenance is enabled.",
      evidence: "package.json -> publishConfig.provenance=true",
    };
  }

  return {
    id: "publish-provenance",
    status: options.requireProvenance ? "fail" : "warn",
    message: "publishConfig.provenance is disabled or missing.",
    evidence: "package.json -> publishConfig.provenance not true",
  };
}

async function checkSbom(options: AttestOptions): Promise<AttestCheck> {
  const candidates = [
    ".artifacts/sbom.spdx.json",
    ".artifacts/deps-report.sarif",
    "sbom.spdx.json",
  ];

  for (const candidate of candidates) {
    if (await Bun.file(path.join(options.cwd, candidate)).exists()) {
      return {
        id: "sbom-present",
        status: "pass",
        message: "SBOM/report artifact found.",
        evidence: candidate,
      };
    }
  }

  return {
    id: "sbom-present",
    status: options.requireSbom ? "fail" : "warn",
    message: "No SBOM/report artifact detected under expected paths.",
  };
}

async function checkWorkflowSigning(options: AttestOptions): Promise<AttestCheck> {
  const workflows = await findWorkflows(options.cwd);
  let matched = "";

  for (const workflow of workflows) {
    const content = await Bun.file(path.join(options.cwd, workflow)).text();
    if (/slsa|cosign|attest|provenance|sigstore/i.test(content)) {
      matched = workflow;
      break;
    }
  }

  if (matched) {
    return {
      id: "workflow-signing",
      status: "pass",
      message: "Workflow includes signing/provenance-related automation.",
      evidence: matched,
    };
  }

  return {
    id: "workflow-signing",
    status: options.requireSigning ? "fail" : "warn",
    message: "No signing/provenance automation found in workflows.",
  };
}

async function checkChecksums(options: AttestOptions): Promise<AttestCheck> {
  const candidates = ["dist/checksums.txt", ".artifacts/checksums.txt"];
  for (const candidate of candidates) {
    if (await Bun.file(path.join(options.cwd, candidate)).exists()) {
      return {
        id: "checksums-present",
        status: "pass",
        message: "Release checksum artifact found.",
        evidence: candidate,
      };
    }
  }

  return {
    id: "checksums-present",
    status: "warn",
    message: "Checksum artifact not found in default locations.",
  };
}

async function checkDecisionArtifact(options: AttestOptions): Promise<AttestCheck> {
  const candidate = ".artifacts/decision-plan.json";
  const exists = await Bun.file(path.join(options.cwd, candidate)).exists();
  if (exists) {
    return {
      id: "decision-artifact",
      status: "pass",
      message: "Decision-plan artifact is present.",
      evidence: candidate,
    };
  }

  return {
    id: "decision-artifact",
    status: "warn",
    message: "Decision-plan artifact is missing.",
  };
}

async function findWorkflows(cwd: string): Promise<string[]> {
  const dir = path.join(cwd, ".github", "workflows");
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")))
      .map((entry) => path.posix.join(".github/workflows", entry.name));
  } catch {
    const matched = new Set<string>();
    for (const pattern of WORKFLOW_GLOBS) {
      const glob = new Bun.Glob(pattern);
      for await (const relative of glob.scan({ cwd, onlyFiles: true })) {
        matched.add(relative);
      }
    }
    return Array.from(matched);
  }
}
