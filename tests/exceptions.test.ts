import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runExceptionsService } from "../src/services/exceptions.js";

test("exceptions service can add and list active entries", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-exceptions-"));
  const filePath = path.join(cwd, ".rainy", "exceptions.json");

  const add = await runExceptionsService({
    cwd,
    action: "add",
    packageName: "lodash",
    cveId: "CVE-2026-0001",
    reason: "runtime path is isolated",
    owner: "platform-security",
    evidence: "static import graph",
    status: "accepted_risk",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    filePath,
    format: "json",
    jsonFile: undefined,
    id: undefined,
    activeOnly: false,
    strict: false,
  });

  expect(add.errors.length).toBe(0);

  const listed = await runExceptionsService({
    cwd,
    action: "list",
    filePath,
    format: "json",
    jsonFile: undefined,
    id: undefined,
    packageName: undefined,
    cveId: undefined,
    reason: undefined,
    owner: undefined,
    evidence: undefined,
    status: undefined,
    expiresAt: undefined,
    activeOnly: true,
    strict: false,
  });

  expect(listed.entries.length).toBe(1);
  expect(listed.active).toBe(1);
  expect(listed.entries[0]?.packageName).toBe("lodash");
});

test("exceptions validate strict mode reports overly long accepted risk", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-exceptions-strict-"));
  const filePath = path.join(cwd, ".rainy", "exceptions.json");

  await runExceptionsService({
    cwd,
    action: "add",
    packageName: "axios",
    cveId: "CVE-2026-0002",
    reason: "temporary accepted risk",
    owner: "security",
    evidence: "risk review doc",
    status: "accepted_risk",
    expiresAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
    filePath,
    format: "json",
    jsonFile: undefined,
    id: undefined,
    activeOnly: false,
    strict: false,
  });

  const validated = await runExceptionsService({
    cwd,
    action: "validate",
    filePath,
    format: "json",
    jsonFile: undefined,
    id: undefined,
    packageName: undefined,
    cveId: undefined,
    reason: undefined,
    owner: undefined,
    evidence: undefined,
    status: undefined,
    expiresAt: undefined,
    activeOnly: false,
    strict: true,
  });

  expect(validated.errors.some((entry) => entry.includes("accepted_risk"))).toBe(true);
});
