#!/usr/bin/env bun
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

if (import.meta.main) {
  void main();
}
