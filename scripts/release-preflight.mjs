#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function main() {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const pkgName = String(pkg.name ?? '').trim();

  if (!pkgName) {
    fail('package.json is missing a valid "name".');
  }

  const token = process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN;
  if (!token || token.trim().length === 0) {
    fail('NPM token is missing. Set NPM_TOKEN in GitHub repository secrets.');
  }

  const whoami = await npmWhoAmI();

  const scoped = pkgName.startsWith('@');
  if (scoped) {
    const [scopePart] = pkgName.split('/');
    const scope = scopePart.slice(1);

    if (scope.toLowerCase() !== whoami.toLowerCase()) {
      const exists = await packageExists(pkgName);
      if (!exists) {
        fail(
          `Package ${pkgName} does not exist yet and scope "@${scope}" is not your npm user (${whoami}). ` +
            'Use a scope you own, create the npm org, or add your user/token with publish access to that org.',
        );
      }
    }
  }

  console.log(`Preflight OK: npm user=${whoami}, package=${pkgName}`);
}

async function npmWhoAmI() {
  try {
    const { stdout } = await execFileAsync('npm', ['whoami'], {
      env: process.env,
      timeout: 20000,
    });
    const user = stdout.trim();
    if (!user) throw new Error('empty npm username');
    return user;
  } catch (error) {
    fail(
      'npm auth failed (token invalid/expired or insufficient permissions). ' +
        `Original error: ${String(error?.stderr || error?.message || error)}`,
    );
  }
}

async function packageExists(name) {
  try {
    await execFileAsync('npm', ['view', name, 'version'], {
      env: process.env,
      timeout: 20000,
    });
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(`release-preflight: ${message}`);
  process.exit(1);
}

await main();
