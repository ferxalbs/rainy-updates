#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CLI_VERSION } from "../generated/version.js";
import { parseMcpArgs } from "../commands/mcp/parser.js";
import { runMcp } from "../commands/mcp/runner.js";
import { renderHelp } from "./help.js";
import {
  getRuntimeArgv,
  setRuntimeExitCode,
  writeStderr,
  writeStdout,
} from "../utils/runtime.js";

async function main(): Promise<void> {
  if (typeof Bun === "undefined") {
    const currentFile = fileURLToPath(import.meta.url);
    const result = spawnSync("bun", [currentFile, ...process.argv.slice(2)], {
      stdio: "inherit",
    });

    if (result.error) {
      process.stderr.write(
        "rainy-updates (rup-mcp): Bun is required to run the published JavaScript MCP entrypoint. Install Bun or use the compiled binary release.\n",
      );
      process.exit(1);
    }

    process.exit(result.status ?? 1);
  }

  try {
    const argv = getRuntimeArgv();
    if (argv.includes("--version") || argv.includes("-v")) {
      writeStdout(CLI_VERSION + "\n");
      return;
    }
    if (argv.includes("--help") || argv.includes("-h")) {
      writeStdout(renderHelp("mcp") + "\n");
      return;
    }

    const options = parseMcpArgs(argv);
    await runMcp(options);
  } catch (error) {
    writeStderr(`rainy-updates (rup-mcp): ${String(error)}\n`);
    setRuntimeExitCode(2);
  }
}

void main();
