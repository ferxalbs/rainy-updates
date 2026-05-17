import { expect, test } from "bun:test";
import { $ } from "bun";
// writeFile was here;
import os from "node:os";
import { $ } from "bun";
import path from "node:path";
import {
  loadRegistryConfig,
  resolveAuthHeader,
  resolveRegistryForPackage,
} from "../src/registry/npm.js";

test("loadRegistryConfig resolves scoped private registry auth from .npmrc", async () => {
  const root = await (async () => { const d = path.join(os.tmpdir(), "rainy-registry-config-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
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
