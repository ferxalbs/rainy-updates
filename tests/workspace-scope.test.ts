import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverPackageDirs } from "../src/workspace/discover.js";

test("discoverPackageDirs limits to changed workspace packages with --only-changed semantics", async () => {
  const root = await createWorkspaceRepo("rainy-workspace-scope-");
  await writeFile(path.join(root, "packages", "core", "src", "index.ts"), "export const core = 2;\n", "utf8");

  const dirs = await discoverPackageDirs(root, true, {
    git: { onlyChanged: true },
    includeKinds: ["dependencies"],
  });

  expect(dirs).toEqual([path.join(root, "packages", "core")]);
});

test("discoverPackageDirs expands to dependents with --affected semantics", async () => {
  const root = await createWorkspaceRepo("rainy-workspace-affected-");
  await writeFile(path.join(root, "packages", "core", "src", "index.ts"), "export const core = 2;\n", "utf8");

  const dirs = await discoverPackageDirs(root, true, {
    git: { affected: true },
    includeKinds: ["dependencies"],
    includeDependents: true,
  });

  expect(dirs).toEqual([
    path.join(root, "packages", "app"),
    path.join(root, "packages", "core"),
  ]);
});

test("discoverPackageDirs respects staged scoping", async () => {
  const root = await createWorkspaceRepo("rainy-workspace-staged-");
  await writeFile(path.join(root, "packages", "core", "src", "index.ts"), "export const core = 2;\n", "utf8");
  runGit(root, ["add", "packages/core/src/index.ts"]);

  const dirs = await discoverPackageDirs(root, true, {
    git: { staged: true },
    includeKinds: ["dependencies"],
  });

  expect(dirs).toEqual([path.join(root, "packages", "core")]);
});

async function createWorkspaceRepo(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  await mkdir(path.join(root, "packages", "core", "src"), { recursive: true });
  await mkdir(path.join(root, "packages", "app", "src"), { recursive: true });

  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "workspace-root",
        version: "1.0.0",
        private: true,
        workspaces: ["packages/*"],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages", "core", "package.json"),
    JSON.stringify(
      {
        name: "@repo/core",
        version: "1.0.0",
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  await writeFile(
    path.join(root, "packages", "app", "package.json"),
    JSON.stringify(
      {
        name: "@repo/app",
        version: "1.0.0",
        dependencies: {
          "@repo/core": "^1.0.0",
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  await writeFile(path.join(root, "packages", "core", "src", "index.ts"), "export const core = 1;\n", "utf8");
  await writeFile(path.join(root, "packages", "app", "src", "index.ts"), "export const app = 1;\n", "utf8");

  runGit(root, ["init"]);
  runGit(root, ["config", "user.email", "tests@rainy.dev"]);
  runGit(root, ["config", "user.name", "Rainy Tests"]);
  runGit(root, ["add", "."]);
  runGit(root, ["commit", "-m", "init"]);

  return root;
}

function runGit(cwd: string, args: string[]): void {
  const proc = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr).trim();
    throw new Error(stderr || `git ${args.join(" ")} failed`);
  }
}
