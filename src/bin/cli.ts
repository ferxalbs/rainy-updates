#!/usr/bin/env bun
import { runCli } from "./main.js";

async function main(): Promise<void> {
  await runCli();
}

if (import.meta.main) {
  void main();
}
