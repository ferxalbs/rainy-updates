import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  loadRegistryConfig,
  resolveAuthHeader,
  resolveRegistryForPackage,
} from "../src/registry/npm.js";

test("loadRegistryConfig resolves scoped private registry auth from .npmrc", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rainy-registry-config-"));
  await writeFile(
    path.join(root, ".npmrc"),
    [
      "registry=https://registry.npmjs.org/",
      "@acme:registry=https://npm.acme.test/",
      "//npm.acme.test/:_authToken=test-token",
      "//npm.acme.test/:always-auth=true",
    ].join("\n"),
    "utf8",
  );

  const config = await loadRegistryConfig(root);
  const registry = resolveRegistryForPackage("@acme/widget", config);
  expect(registry).toBe("https://npm.acme.test/");
  expect(resolveAuthHeader(registry, config)).toBe("Bearer test-token");
});
