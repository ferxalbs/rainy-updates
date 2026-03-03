import { chmod, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { writeStdout } from "../../utils/runtime.js";
import type { HookOptions, HookResult } from "../../types/index.js";

const MANAGED_MARKER = "# rainy-updates managed hook";
const HOOKS: Array<{
  name: "pre-commit" | "pre-push";
  command: string;
}> = [
  {
    name: "pre-commit",
    command:
      '$(resolve_rup) unused --workspace --staged && $(resolve_rup) resolve --workspace --staged',
  },
  {
    name: "pre-push",
    command: '$(resolve_rup) audit --workspace --affected --report summary',
  },
];

export async function runHook(options: HookOptions): Promise<HookResult> {
  const hookDir = await resolveHookDir(options.cwd);
  const result: HookResult = {
    action: options.action,
    hookDir,
    installed: [],
    removed: [],
    checked: [],
    errors: [],
    warnings: [],
  };

  if (options.action === "install") {
    await mkdir(hookDir, { recursive: true });

    for (const hook of HOOKS) {
      const hookPath = path.join(hookDir, hook.name);
      const existing = await readHookState(hookPath);
      if (existing.status === "foreign") {
        result.warnings.push(`Skipped ${hook.name}: existing hook is not Rainy-managed.`);
        result.checked.push({ name: hook.name, status: "foreign" });
        continue;
      }

      await Bun.write(hookPath, renderHookScript(hook.command));
      await makeExecutable(hookPath);
      result.installed.push(hook.name);
      result.checked.push({ name: hook.name, status: "managed" });
    }
  } else if (options.action === "uninstall") {
    for (const hook of HOOKS) {
      const hookPath = path.join(hookDir, hook.name);
      const existing = await readHookState(hookPath);
      if (existing.status === "managed") {
        await unlink(hookPath).catch(() => undefined);
        result.removed.push(hook.name);
      } else if (existing.status === "foreign") {
        result.warnings.push(`Left ${hook.name} untouched: existing hook is not Rainy-managed.`);
      }
      result.checked.push({ name: hook.name, status: existing.status });
    }
  } else {
    for (const hook of HOOKS) {
      const hookPath = path.join(hookDir, hook.name);
      const existing = await readHookState(hookPath);
      result.checked.push({ name: hook.name, status: existing.status });
      if (existing.status === "foreign") {
        result.warnings.push(`${hook.name} exists but is not Rainy-managed.`);
      }
    }
  }

  writeStdout(renderHookResult(result) + "\n");
  return result;
}

async function resolveHookDir(cwd: string): Promise<string> {
  const resolved = await runGit(cwd, ["rev-parse", "--git-path", "hooks"]);
  if (!resolved.ok) {
    throw new Error(`Unable to resolve git hooks directory: ${resolved.error}`);
  }
  const hookDir = resolved.stdout.trim();
  if (hookDir.length === 0) {
    throw new Error("Git hooks directory could not be determined.");
  }
  return path.resolve(cwd, hookDir);
}

async function readHookState(
  hookPath: string,
): Promise<{ status: "managed" | "missing" | "foreign"; content?: string }> {
  try {
    const file = Bun.file(hookPath);
    if (!(await file.exists())) {
      return { status: "missing" };
    }

    const content = await file.text();
    return content.includes(MANAGED_MARKER)
      ? { status: "managed", content }
      : { status: "foreign", content };
  } catch {
    return { status: "missing" };
  }
}

function renderHookScript(command: string): string {
  return `#!/bin/sh
${MANAGED_MARKER}
set -eu

resolve_rup() {
  if command -v rup >/dev/null 2>&1; then
    printf '%s' "rup"
    return
  fi
  if command -v rainy-updates >/dev/null 2>&1; then
    printf '%s' "rainy-updates"
    return
  fi
  if command -v rainy-up >/dev/null 2>&1; then
    printf '%s' "rainy-up"
    return
  fi
  printf '%s\n' "Rainy Updates CLI not found in PATH." >&2
  exit 127
}

${command}
`;
}

async function makeExecutable(filePath: string): Promise<void> {
  await chmod(filePath, 0o755);
}

async function runGit(
  cwd: string,
  args: string[],
): Promise<{ ok: true; stdout: string } | { ok: false; error: string }> {
  try {
    const proc = Bun.spawn(["git", ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      return { ok: false, error: stderr.trim() || `git ${args.join(" ")} failed` };
    }
    return { ok: true, stdout };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function renderHookResult(result: HookResult): string {
  const lines = [
    `Hook action: ${result.action}`,
    `Hook dir: ${result.hookDir ?? "unknown"}`,
  ];

  if (result.installed.length > 0) {
    lines.push(`Installed: ${result.installed.join(", ")}`);
  }
  if (result.removed.length > 0) {
    lines.push(`Removed: ${result.removed.join(", ")}`);
  }
  if (result.checked.length > 0) {
    lines.push("Checks:");
    for (const check of result.checked) {
      lines.push(`- ${check.name}: ${check.status}`);
    }
  }
  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  if (result.errors.length > 0) {
    lines.push("Errors:");
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
  }

  return lines.join("\n");
}
