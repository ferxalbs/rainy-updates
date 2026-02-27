import { expect, test } from "bun:test";
import { buildWorkspaceGraph } from "../src/workspace/graph.js";

test("buildWorkspaceGraph returns topological order", () => {
  const manifests = new Map<string, any>([
    ["/repo/packages/a", { name: "a", dependencies: { b: "^1.0.0" } }],
    ["/repo/packages/b", { name: "b", dependencies: { c: "^1.0.0" } }],
    ["/repo/packages/c", { name: "c", dependencies: {} }],
  ]);

  const graph = buildWorkspaceGraph(manifests, ["dependencies"]);
  const idx = (p: string) => graph.orderedPaths.indexOf(p);

  expect(idx("/repo/packages/c")).toBeLessThan(idx("/repo/packages/b"));
  expect(idx("/repo/packages/b")).toBeLessThan(idx("/repo/packages/a"));
  expect(graph.cycles.length).toBe(0);
});

test("buildWorkspaceGraph ignores workspace protocol edges", () => {
  const manifests = new Map<string, any>([
    ["/repo/packages/app", { name: "app", dependencies: { core: "workspace:*" } }],
    ["/repo/packages/core", { name: "core", dependencies: {} }],
  ]);

  const graph = buildWorkspaceGraph(manifests, ["dependencies"]);
  const appNode = graph.nodes.find((node) => node.packageName === "app");
  expect(appNode?.dependsOn.includes("core")).toBe(false);
});
