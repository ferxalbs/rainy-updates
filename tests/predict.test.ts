import { expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderPredictResult, runPredictService } from "../src/services/predict.js";

test("predict analyzes decision plan scope", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-predict-"));
  const planPath = path.join(dir, ".artifacts", "decision-plan.json");
  await mkdir(path.dirname(planPath), { recursive: true });
  await Bun.write(
    planPath,
    JSON.stringify(
      {
        contractVersion: "1",
        createdAt: new Date(0).toISOString(),
        sourceCommand: "rup dashboard --mode review",
        mode: "review",
        focus: "all",
        projectPath: dir,
        target: "latest",
        interactiveSurface: "dashboard",
        summary: { totalItems: 2, selectedItems: 2 },
        items: [
          {
            packagePath: path.join(dir, "package.json"),
            name: "react",
            kind: "dependencies",
            fromRange: "^19.2.0",
            toRange: "^20.0.0",
            toVersionResolved: "20.0.0",
            diffType: "major",
            riskLevel: "high",
            riskScore: 91,
            policyAction: "review",
            decisionState: "review",
            selected: true,
          },
          {
            packagePath: path.join(dir, "package.json"),
            name: "typescript",
            kind: "devDependencies",
            fromRange: "^5.8.0",
            toRange: "^5.9.0",
            toVersionResolved: "5.9.3",
            diffType: "minor",
            riskLevel: "low",
            riskScore: 20,
            policyAction: "block",
            decisionState: "blocked",
            selected: true,
          },
        ],
      },
      null,
      2,
    ),
  );

  const result = await runPredictService({
    cwd: dir,
    workspace: false,
    fromPlanFile: planPath,
    packageName: undefined,
    format: "json",
    jsonFile: undefined,
    includeChangelog: false,
    failOnRisk: false,
    concurrency: 16,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    cacheTtlSeconds: 3600,
  });

  expect(result.scope).toBe("plan");
  expect(result.prediction).toBe("Blocked by Policy");
  expect(result.riskLevel).toBe("Severe");
  expect(result.predictedBlocked).toBe(1);
  expect(renderPredictResult(result, "minimal")).toContain("Prediction:");
});
