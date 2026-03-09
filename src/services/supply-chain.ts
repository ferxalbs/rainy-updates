import path from "node:path";
import { readdir } from "node:fs/promises";
import type {
  PolicyAction,
  RiskLevel,
  SupplyChainFinding,
  SupplyChainOptions,
  SupplyChainResult,
  SupplyChainScope,
} from "../types/index.js";

const SKIP_SEGMENTS = new Set(["node_modules", "dist", ".git", ".artifacts"]);

export async function runSupplyChainService(
  options: SupplyChainOptions,
): Promise<SupplyChainResult> {
  const findings: SupplyChainFinding[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const scannedFiles = new Set<string>();

  try {
    const scopes = new Set(options.scopes);
    if (scopes.has("docker")) {
      const files = await collectFiles(options.cwd, ["**/Dockerfile", "**/Dockerfile.*"]);
      files.forEach((file) => scannedFiles.add(file));
      for (const file of files) {
        findings.push(...await scanDockerFile(options.cwd, file));
      }
    }

    if (scopes.has("actions")) {
      const files = await collectWorkflowFiles(options.cwd);
      files.forEach((file) => scannedFiles.add(file));
      for (const file of files) {
        findings.push(...await scanActionsWorkflow(options.cwd, file));
      }
    }

    if (scopes.has("terraform")) {
      const files = await collectFiles(options.cwd, ["**/*.tf"]);
      files.forEach((file) => scannedFiles.add(file));
      for (const file of files) {
        findings.push(...await scanTerraformFile(options.cwd, file));
      }
    }

    if (scopes.has("helm")) {
      const files = await collectFiles(options.cwd, ["**/Chart.yaml"]);
      files.forEach((file) => scannedFiles.add(file));
      for (const file of files) {
        findings.push(...await scanHelmChart(options.cwd, file));
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (scannedFiles.size === 0) {
    warnings.push("No supply-chain files matched selected scopes.");
  }

  return {
    findings,
    summary: {
      scannedFiles: scannedFiles.size,
      totalFindings: findings.length,
      byTargetType: {
        "docker-image": findings.filter((item) => item.targetType === "docker-image").length,
        "github-action": findings.filter((item) => item.targetType === "github-action").length,
        "terraform-provider": findings.filter((item) => item.targetType === "terraform-provider").length,
        "helm-dependency": findings.filter((item) => item.targetType === "helm-dependency").length,
      },
      byPolicyAction: {
        allow: findings.filter((item) => item.policyAction === "allow").length,
        review: findings.filter((item) => item.policyAction === "review").length,
        block: findings.filter((item) => item.policyAction === "block").length,
        monitor: findings.filter((item) => item.policyAction === "monitor").length,
      },
    },
    errors,
    warnings,
  };
}

async function collectFiles(cwd: string, patterns: string[]): Promise<string[]> {
  const results = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for await (const relative of glob.scan({ cwd, onlyFiles: true })) {
      if (shouldSkip(relative)) {
        continue;
      }
      results.add(relative);
    }
  }
  return Array.from(results).sort((left, right) => left.localeCompare(right));
}

async function collectWorkflowFiles(cwd: string): Promise<string[]> {
  const dir = path.join(cwd, ".github", "workflows");
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")))
      .map((entry) => path.posix.join(".github/workflows", entry.name));
  } catch {
    return collectFiles(cwd, [".github/workflows/*.yml", ".github/workflows/*.yaml"]);
  }
}

function shouldSkip(filePath: string): boolean {
  const parts = filePath.split("/");
  return parts.some((part) => SKIP_SEGMENTS.has(part));
}

async function scanDockerFile(cwd: string, relativePath: string): Promise<SupplyChainFinding[]> {
  const sourceFile = await Bun.file(path.join(cwd, relativePath)).text();
  const findings: SupplyChainFinding[] = [];

  const fromRegex = /^\s*FROM\s+([^\s#]+)/gm;
  for (const match of sourceFile.matchAll(fromRegex)) {
    const reference = match[1] ?? "";
    const [name, tag] = splitImageReference(reference);
    const pinnedByDigest = reference.includes("@sha256:");
    const reasons: string[] = [];

    let riskLevel: RiskLevel;
    let policyAction: PolicyAction;
    let recommendedAction: string;

    if (pinnedByDigest) {
      riskLevel = "low";
      policyAction = "allow";
      recommendedAction = "Keep digest pinning and rotate regularly.";
      reasons.push("Image is pinned by immutable digest.");
    } else if (!tag || tag === "latest") {
      riskLevel = "high";
      policyAction = "block";
      recommendedAction = "Pin image by digest (recommended) or exact immutable tag.";
      reasons.push("Image tag is missing or uses latest.");
    } else {
      riskLevel = "medium";
      policyAction = "review";
      recommendedAction = "Consider digest pinning to prevent mutable tag drift.";
      reasons.push("Image uses version tag but not digest pinning.");
    }

    findings.push({
      targetType: "docker-image",
      name,
      reference,
      sourceFile: relativePath,
      riskLevel,
      policyAction,
      recommendedAction,
      reasons,
    });
  }

  return findings;
}

async function scanActionsWorkflow(cwd: string, relativePath: string): Promise<SupplyChainFinding[]> {
  const sourceFile = await Bun.file(path.join(cwd, relativePath)).text();
  const findings: SupplyChainFinding[] = [];

  const usesRegex = /^\s*-?\s*uses:\s*([^\s#]+)/gm;
  for (const match of sourceFile.matchAll(usesRegex)) {
    const entry = match[1] ?? "";
    if (!entry.includes("@")) {
      continue;
    }
    const [name, reference] = entry.split("@", 2);
    const pinnedSha = /^[a-f0-9]{40}$/i.test(reference);
    const versionTag = /^v?\d+(?:\.\d+)*$/.test(reference);

    let riskLevel: RiskLevel;
    let policyAction: PolicyAction;
    let recommendedAction: string;
    const reasons: string[] = [];

    if (pinnedSha) {
      riskLevel = "low";
      policyAction = "allow";
      recommendedAction = "Keep SHA pinning and rotate via trusted updater.";
      reasons.push("Action is pinned to a full commit SHA.");
    } else if (versionTag) {
      riskLevel = "medium";
      policyAction = "review";
      recommendedAction = "Pin to commit SHA for stronger supply-chain integrity.";
      reasons.push("Action is version-tagged but mutable over time.");
    } else {
      riskLevel = "high";
      policyAction = "block";
      recommendedAction = "Use immutable commit SHA pinning before release gating.";
      reasons.push("Action reference is not immutable and not semver-tagged.");
    }

    findings.push({
      targetType: "github-action",
      name,
      reference,
      sourceFile: relativePath,
      riskLevel,
      policyAction,
      recommendedAction,
      reasons,
    });
  }

  return findings;
}

async function scanTerraformFile(cwd: string, relativePath: string): Promise<SupplyChainFinding[]> {
  const sourceFile = await Bun.file(path.join(cwd, relativePath)).text();
  const findings: SupplyChainFinding[] = [];

  const sourceRegex = /source\s*=\s*"([^"]+)"/gm;
  for (const match of sourceFile.matchAll(sourceRegex)) {
    const source = match[1] ?? "unknown";
    const offset = match.index ?? 0;
    const context = sourceFile.slice(offset, offset + 240);
    const version = context.match(/version\s*=\s*"([^"]+)"/)?.[1] ?? "";
    const exactVersion = /^=?\s*\d+\.\d+\.\d+$/.test(version);

    let riskLevel: RiskLevel;
    let policyAction: PolicyAction;
    let recommendedAction: string;
    const reasons: string[] = [];

    if (!version) {
      riskLevel = "high";
      policyAction = "block";
      recommendedAction = "Set explicit provider version constraints for deterministic runs.";
      reasons.push("Provider has no version constraint.");
    } else if (exactVersion) {
      riskLevel = "low";
      policyAction = "allow";
      recommendedAction = "Keep provider version pinned and update intentionally.";
      reasons.push("Provider has exact version pinning.");
    } else {
      riskLevel = "medium";
      policyAction = "review";
      recommendedAction = "Prefer exact pinning when promoting release artifacts.";
      reasons.push("Provider uses ranged version constraint.");
    }

    findings.push({
      targetType: "terraform-provider",
      name: source,
      reference: version || "unbounded",
      sourceFile: relativePath,
      riskLevel,
      policyAction,
      recommendedAction,
      reasons,
    });
  }

  return findings;
}

async function scanHelmChart(cwd: string, relativePath: string): Promise<SupplyChainFinding[]> {
  const sourceFile = await Bun.file(path.join(cwd, relativePath)).text();
  const findings: SupplyChainFinding[] = [];

  const lines = sourceFile.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const nameMatch = lines[index]?.match(/^\s*-\s*name:\s*(.+)\s*$/);
    if (!nameMatch) {
      continue;
    }
    const name = nameMatch[1]?.trim() ?? "unknown";
    let version = "";
    for (let probe = index + 1; probe < lines.length; probe += 1) {
      if (/^\s*-\s*name:\s*/.test(lines[probe] ?? "")) {
        break;
      }
      const versionMatch = lines[probe]?.match(/^\s*version:\s*(.+)\s*$/);
      if (versionMatch) {
        version = versionMatch[1]?.trim().replace(/^"|"$/g, "") ?? "";
        break;
      }
    }
    const exactVersion = /^\d+\.\d+\.\d+$/.test(version);

    let riskLevel: RiskLevel;
    let policyAction: PolicyAction;
    let recommendedAction: string;
    const reasons: string[] = [];

    if (!version) {
      riskLevel = "high";
      policyAction = "block";
      recommendedAction = "Pin Helm dependency versions for deterministic releases.";
      reasons.push("Helm dependency has no explicit version.");
    } else if (exactVersion) {
      riskLevel = "low";
      policyAction = "allow";
      recommendedAction = "Keep exact Helm dependency pinning.";
      reasons.push("Helm dependency uses exact version pinning.");
    } else {
      riskLevel = "medium";
      policyAction = "review";
      recommendedAction = "Avoid range-style Helm versions for release-critical environments.";
      reasons.push("Helm dependency uses a non-exact version expression.");
    }

    findings.push({
      targetType: "helm-dependency",
      name,
      reference: version || "unbounded",
      sourceFile: relativePath,
      riskLevel,
      policyAction,
      recommendedAction,
      reasons,
    });
  }

  return findings;
}

function splitImageReference(reference: string): [string, string | undefined] {
  const digestIndex = reference.indexOf("@");
  const noDigest = digestIndex >= 0 ? reference.slice(0, digestIndex) : reference;
  const colonIndex = noDigest.lastIndexOf(":");
  if (colonIndex <= noDigest.lastIndexOf("/")) {
    return [noDigest, undefined];
  }
  return [noDigest.slice(0, colonIndex), noDigest.slice(colonIndex + 1)];
}
