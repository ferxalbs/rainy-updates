import { expect, test } from "bun:test";
import { $ } from "bun";
// writeFile was here;
import os from "node:os";
import { $ } from "bun";
import path from "node:path";
import {
  buildAddInvocation,
  buildInstallInvocation,
  createPackageManagerProfile,
  detectPackageManagerDetails,
} from "../src/pm/detect.js";

test("detectPackageManagerDetails prefers packageManager field over lockfile", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-pm-field-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "pm-field-fixture",
        version: "1.0.0",
        packageManager: "pnpm@9.15.0",
      },
      null,
      2,
    ),
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "package-lock.json"), "{}\n");

  const detected = await detectPackageManagerDetails(dir);
  expect(detected.manager).toBe("pnpm");
  expect(detected.source).toBe("packageManager-field");
  expect(detected.packageManagerField).toBe("pnpm@9.15.0");
});

test("buildInstallInvocation uses immutable installs for Yarn Berry", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-pm-yarn-berry-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "pm-yarn-berry-fixture",
        version: "1.0.0",
        packageManager: "yarn@4.6.0",
      },
      null,
      2,
    ),
    "utf8",
  );

  const detected = await detectPackageManagerDetails(dir);
  const profile = createPackageManagerProfile("auto", detected);
  const install = buildInstallInvocation(profile, { frozen: true, ci: true });

  expect(profile.manager).toBe("yarn");
  expect(profile.yarnFlavor).toBe("berry");
  expect(install.display).toBe("yarn install --immutable");
});

test("buildAddInvocation keeps Yarn package adds on yarn", () => {
  const profile = createPackageManagerProfile(
    "yarn",
    { manager: "unknown", source: "fallback" },
  );
  const add = buildAddInvocation(profile, ["react@19.0.0"], {
    exact: true,
    noSave: true,
  });

  expect(add.display).toBe("yarn add --exact react@19.0.0");
});
