import { Glob } from "bun";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

async function run() {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "bun-glob-test-"));
  await mkdir(path.join(cwd, ".github", "workflows"), { recursive: true });
  await writeFile(path.join(cwd, ".github", "workflows", "ci.yml"), "test");
  
  await mkdir(path.join(cwd, "workflows"), { recursive: true });
  await writeFile(path.join(cwd, "workflows", "ci.yml"), "test");
  
  const patterns = [
    "workflows/*.yml",
    "**/*.yml",
    ".github/workflows/*.yml"
  ];
  
  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    console.log(`\nPattern: ${pattern}`);
    const results = [];
    for (const file of glob.scanSync({ cwd })) {
      results.push(file);
    }
    console.log("Results (scanSync):", results);
  }
  
  await rm(cwd, { recursive: true });
}

run();
