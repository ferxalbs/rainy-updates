#!/usr/bin/env node
import process from "node:process";
import { parseCliArgs } from "../core/options.js";
import { check } from "../core/check.js";
import { upgrade } from "../core/upgrade.js";
import { renderResult } from "../output/format.js";

async function main(): Promise<void> {
  try {
    const parsed = parseCliArgs(process.argv.slice(2));

    const result =
      parsed.command === "upgrade"
        ? await upgrade(parsed.options)
        : await check(parsed.options);

    process.stdout.write(renderResult(result, parsed.options.format) + "\n");

    if (parsed.options.ci && result.updates.length > 0) {
      process.exitCode = 1;
      return;
    }

    if (result.errors.length > 0) {
      process.exitCode = 2;
    }
  } catch (error) {
    process.stderr.write(`rainy-updates: ${String(error)}\n`);
    process.exitCode = 2;
  }
}

void main();
