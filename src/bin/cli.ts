#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runCli } from "./main.js";

async function main(): Promise<void> {
  if (typeof Bun === "undefined") {
    const currentFile = fileURLToPath(import.meta.url);
    const result = spawnSync("bun", [currentFile, ...process.argv.slice(2)], {
      stdio: "inherit",
    });

    if (result.error) {
      process.stderr.write(
        "rainy-updates (rup): Bun is required to run the published JavaScript entrypoint. Install Bun or use the compiled binary release.\n",
      );
      process.exit(1);
    }

    process.exit(result.status ?? 1);
  }

  await runCli();
}

void main();
