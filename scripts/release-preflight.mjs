#!/usr/bin/env bun

async function main() {
  const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();
  const pkgName = String(pkg.name ?? "").trim();

  if (!pkgName) {
    fail('package.json is missing a valid "name".');
  }

  const token = process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN;
  if (!token || token.trim().length === 0) {
    fail("NPM token is missing. Set NPM_TOKEN in GitHub repository secrets.");
  }

  const whoami = await npmWhoAmI();

  const scoped = pkgName.startsWith("@");
  if (scoped) {
    const [scopePart] = pkgName.split("/");
    const scope = scopePart.slice(1);

    if (scope.toLowerCase() !== whoami.toLowerCase()) {
      const exists = await packageExists(pkgName);
      if (!exists) {
        const hasOrgMembership = await userIsOrgMember(scope, whoami);
        if (hasOrgMembership) {
          console.log(
            `Preflight: scope @${scope} detected and user ${whoami} is an org member.`,
          );
          console.log(
            `Preflight: first publish for ${pkgName} is allowed to proceed.`,
          );
          console.log(`Preflight OK: npm user=${whoami}, package=${pkgName}`);
          return;
        }

        fail(
          `Package ${pkgName} does not exist yet and scope "@${scope}" is not your npm user (${whoami}). ` +
            "Use a scope you own, create the npm org, or add your user/token with publish access to that org.",
        );
      }
    }
  }

  console.log(`Preflight OK: npm user=${whoami}, package=${pkgName}`);
}

async function npmWhoAmI() {
  try {
    const user = await runNpmCommand(["whoami"]);
    if (!user) throw new Error("empty npm username");
    return user;
  } catch (error) {
    fail(
      "npm auth failed (token invalid/expired or insufficient permissions). " +
        `Original error: ${String(error)}`,
    );
  }
}

async function packageExists(name) {
  try {
    await runNpmCommand(["view", name, "version"]);
    return true;
  } catch {
    return false;
  }
}

async function userIsOrgMember(scope, username) {
  try {
    const stdout = await runNpmCommand(["org", "ls", scope]);
    return stdout.toLowerCase().includes(username.toLowerCase());
  } catch {
    return false;
  }
}

async function runNpmCommand(args) {
  const proc = Bun.spawn(["npm", ...args], {
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 20000,
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    proc.stdout.text(),
    proc.stderr.text(),
  ]);
  if (exitCode !== 0) {
    throw new Error(
      stderr.trim() || stdout.trim() || `npm ${args.join(" ")} failed`,
    );
  }
  return stdout.trim();
}

function fail(message) {
  console.error(`release-preflight: ${message}`);
  process.exit(1);
}

await main();
