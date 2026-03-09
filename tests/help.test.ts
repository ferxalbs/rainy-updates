import { expect, test } from "bun:test";
import { renderHelp } from "../src/bin/help.js";

test("renderHelp returns command-specific help", () => {
  const output = renderHelp("doctor");
  expect(output).toContain("rainy-updates doctor [options]");
  expect(output).toContain("--verdict-only");
  expect(output).toContain("--include-changelog");
});

test("renderHelp includes dashboard-specific help", () => {
  const output = renderHelp("dashboard");
  expect(output).toContain("rainy-updates dashboard [options]");
  expect(output).toContain("--view dependencies|security|health");
  expect(output).toContain("--mode check|review|upgrade");
  expect(output).toContain("--focus all|security|risk|major|blocked|workspace");
});

test("renderHelp includes self-update command help", () => {
  const output = renderHelp("self-update");
  expect(output).toContain("rainy-updates self-update [options]");
  expect(output).toContain("--apply");
  expect(output).toContain("--pm auto|bun|npm|pnpm");
});

test("renderHelp includes badge command help", () => {
  const output = renderHelp("badge");
  expect(output).toContain("rainy-updates badge [url|init] [options]");
  expect(output).toContain("--owner <owner>");
  expect(output).toContain("--readme");
});

test("renderHelp includes supply-chain and attest command help", () => {
  const supplyChain = renderHelp("supply-chain");
  expect(supplyChain).toContain("rainy-updates supply-chain [options]");
  expect(supplyChain).toContain("--scope all|docker|actions|terraform|helm");

  const attest = renderHelp("attest");
  expect(attest).toContain("rainy-updates attest [options]");
  expect(attest).toContain("--action verify|report");
});

test("renderHelp returns global help for unknown command context", () => {
  const output = renderHelp(undefined);
  expect(output).toContain("rainy-updates (rup / rainy-up) <command> [options]");
  expect(output).toContain("check       Detect candidate updates");
  expect(output).toContain("predict     Predict upgrade break risk with confidence");
  expect(output).toContain("self-update Check or apply Rainy CLI updates");
  expect(output).toContain("reachability Estimate exploitability reachability for advisories");
  expect(output).toContain("badge       Scaffold and print repo health badge setup");
  expect(output).toContain("supply-chain Scan Docker/GitHub Actions/Terraform/Helm supply-chain risk");
  expect(output).toContain("attest      Verify provenance/signing/SBOM release posture");
  expect(output).toContain("--version, -v");
});
