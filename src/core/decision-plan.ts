import path from "node:path";
import type {
  DashboardMode,
  DecisionPlan,
  DecisionPlanItem,
  PackageUpdate,
  QueueFocus,
  ReviewItem,
  ReviewResult,
  UpgradeOptions,
} from "../types/index.js";
import { stableStringify } from "../utils/stable-json.js";
import { writeFileAtomic } from "../utils/io.js";

export function defaultDecisionPlanPath(cwd: string): string {
  return path.resolve(cwd, ".artifacts/decision-plan.json");
}

export function filterReviewItemsByFocus(
  items: ReviewItem[],
  focus: QueueFocus,
): ReviewItem[] {
  if (focus === "security") {
    return items.filter((item) => item.advisories.length > 0);
  }
  if (focus === "risk") {
    return items.filter(
      (item) =>
        item.update.riskLevel === "critical" || item.update.riskLevel === "high",
    );
  }
  if (focus === "major") {
    return items.filter((item) => item.update.diffType === "major");
  }
  if (focus === "blocked") {
    return items.filter((item) => item.update.decisionState === "blocked");
  }
  if (focus === "workspace") {
    return items.filter((item) => Boolean(item.update.workspaceGroup));
  }
  return items;
}

export function createDecisionPlan(input: {
  review: ReviewResult;
  selectedItems: ReviewItem[];
  sourceCommand: string;
  mode: DashboardMode;
  focus: QueueFocus;
}): DecisionPlan {
  const selectedKeys = new Set(
    input.selectedItems.map((item) => packageUpdateKey(item.update)),
  );

  const items = input.review.items.map((item) => ({
    ...toDecisionPlanItem(item.update),
    selected: selectedKeys.has(packageUpdateKey(item.update)),
  }));

  return {
    contractVersion: "1",
    createdAt: new Date().toISOString(),
    sourceCommand: input.sourceCommand,
    mode: input.mode,
    focus: input.focus,
    projectPath: input.review.projectPath,
    target: input.review.target,
    interactiveSurface: "dashboard",
    summary: {
      totalItems: items.length,
      selectedItems: items.filter((item) => item.selected).length,
    },
    items,
  };
}

export async function writeDecisionPlan(
  filePath: string,
  plan: DecisionPlan,
): Promise<void> {
  await writeFileAtomic(filePath, stableStringify(plan, 2) + "\n");
}

export async function readDecisionPlan(filePath: string): Promise<DecisionPlan> {
  const { readFile } = await import("node:fs/promises");
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as DecisionPlan;

  if (
    parsed.contractVersion !== "1" ||
    !Array.isArray(parsed.items) ||
    typeof parsed.projectPath !== "string"
  ) {
    throw new Error(`Invalid decision plan: ${filePath}`);
  }

  return parsed;
}

export function selectedUpdatesFromPlan(plan: DecisionPlan): PackageUpdate[] {
  return plan.items.filter((item) => item.selected).map(toPackageUpdate);
}

export function resolveDecisionPlanPath(
  options: Pick<UpgradeOptions, "cwd" | "decisionPlanFile">,
  explicit?: string,
): string {
  return explicit ?? options.decisionPlanFile ?? defaultDecisionPlanPath(options.cwd);
}

function toDecisionPlanItem(update: PackageUpdate): DecisionPlanItem {
  return {
    packagePath: update.packagePath,
    name: update.name,
    kind: update.kind,
    fromRange: update.fromRange,
    toRange: update.toRange,
    toVersionResolved: update.toVersionResolved,
    diffType: update.diffType,
    riskLevel: update.riskLevel,
    riskScore: update.riskScore,
    policyAction: update.policyAction,
    decisionState: update.decisionState,
    selected: true,
  };
}

function toPackageUpdate(item: DecisionPlanItem): PackageUpdate {
  return {
    packagePath: item.packagePath,
    name: item.name,
    kind: item.kind,
    fromRange: item.fromRange,
    toRange: item.toRange,
    toVersionResolved: item.toVersionResolved,
    diffType: item.diffType,
    filtered: false,
    autofix: true,
    riskLevel: item.riskLevel,
    riskScore: item.riskScore,
    policyAction: item.policyAction,
    decisionState: item.decisionState,
  };
}

function packageUpdateKey(update: PackageUpdate): string {
  return [
    update.packagePath,
    update.kind,
    update.name,
    update.fromRange,
    update.toRange,
  ].join("::");
}
