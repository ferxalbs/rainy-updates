#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseCliArgs } from "../core/options.js";
import { check } from "../core/check.js";
import { upgrade } from "../core/upgrade.js";
import { warmCache } from "../core/warm-cache.js";
import { initCiWorkflow } from "../core/init-ci.js";
import { renderResult } from "../output/format.js";
import { writeGitHubOutput } from "../output/github.js";
import { createSarifReport } from "../output/sarif.js";
import { renderPrReport } from "../output/pr-report.js";

async function main(): Promise<void> {
  try {
    const parsed = await parseCliArgs(process.argv.slice(2));

    if (parsed.command === "init-ci") {
      const workflow = await initCiWorkflow(parsed.options.cwd, parsed.options.force);
      process.stdout.write(
        workflow.created
          ? `Created CI workflow at ${workflow.path}\n`
          : `CI workflow already exists at ${workflow.path}. Use --force to overwrite.\n`,
      );
      return;
    }

    const result =
      parsed.command === "upgrade"
        ? await upgrade(parsed.options)
        : parsed.command === "warm-cache"
          ? await warmCache(parsed.options)
          : await check(parsed.options);

    const rendered = renderResult(result, parsed.options.format);
    process.stdout.write(rendered + "\n");

    if (parsed.options.jsonFile) {
      await fs.mkdir(path.dirname(parsed.options.jsonFile), { recursive: true });
      await fs.writeFile(parsed.options.jsonFile, JSON.stringify(result, null, 2) + "\n", "utf8");
    }

    if (parsed.options.prReportFile) {
      const markdown = renderPrReport(result);
      await fs.mkdir(path.dirname(parsed.options.prReportFile), { recursive: true });
      await fs.writeFile(parsed.options.prReportFile, markdown + "\n", "utf8");
    }

    if (parsed.options.githubOutputFile) {
      await writeGitHubOutput(parsed.options.githubOutputFile, result);
    }

    if (parsed.options.sarifFile) {
      const sarif = createSarifReport(result);
      await fs.mkdir(path.dirname(parsed.options.sarifFile), { recursive: true });
      await fs.writeFile(parsed.options.sarifFile, JSON.stringify(sarif, null, 2) + "\n", "utf8");
    }

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
