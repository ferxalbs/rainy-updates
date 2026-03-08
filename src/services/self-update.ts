import { VersionCache } from "../cache/cache.js";
import { CLI_VERSION } from "../generated/version.js";
import { NpmRegistryClient } from "../registry/npm.js";
import type {
  SelfUpdateChannel,
  SelfUpdateOptions,
  SelfUpdateResult,
} from "../types/index.js";
import { parseVersion, compareVersions } from "../utils/semver.js";

const CLI_PACKAGE_NAME = "@rainy-updates/cli";
const SELF_CACHE_KEY = `${CLI_PACKAGE_NAME}::self`;

type SelfUpdateDeps = {
  now?: () => number;
  resolveLatestVersion?: () => Promise<string | null>;
  execute?: (command: string, args: string[], cwd: string) => Promise<number>;
  detectChannel?: () => SelfUpdateChannel;
  detectManager?: () => "bun" | "npm" | "pnpm";
  useCache?: boolean;
  ttlHours?: number;
};

export async function runSelfUpdateService(
  options: SelfUpdateOptions,
  deps: SelfUpdateDeps = {},
): Promise<SelfUpdateResult> {
  const status = await resolveSelfUpdateStatus(options.cwd, deps);
  const channel = options.packageManager === "auto"
    ? (deps.detectChannel?.() ?? detectSelfUpdateChannel())
    : (`global-${options.packageManager}` as SelfUpdateChannel);
  const manager = options.packageManager === "auto"
    ? (deps.detectManager?.() ?? detectPreferredManager())
    : options.packageManager;

  const warnings = [...status.warnings];
  const errors: string[] = [];
  const recommendedCommand = buildRecommendedCommand(channel, manager);
  let applied = false;

  if (options.action === "apply") {
    if (!status.outdated) {
      warnings.push("Rainy Updates is already on the latest published version.");
    } else if (channel === "binary") {
      warnings.push(
        "Standalone binary install detected. Replace the binary manually from the latest GitHub release.",
      );
    } else if (!options.yes) {
      warnings.push("Re-run with --apply --yes to confirm global CLI update.");
    } else if (!recommendedCommand) {
      errors.push("Unable to determine a safe update command for this environment.");
    } else {
      const [command, ...args] = recommendedCommand.split(" ");
      const execute = deps.execute ?? executeCommand;
      const code = await execute(command, args, options.cwd);
      if (code === 0) {
        applied = true;
      } else {
        errors.push(`${recommendedCommand} failed with exit code ${code}.`);
      }
    }
  }

  return {
    currentVersion: CLI_VERSION,
    latestVersion: status.latestVersion,
    outdated: status.outdated,
    channel,
    action: options.action,
    applied,
    recommendedCommand: recommendedCommand ?? "Manual update required",
    checkedAt: new Date((deps.now ?? Date.now)()).toISOString(),
    errors,
    warnings,
  };
}

export async function resolveSelfUpdateStatus(
  cwd: string,
  deps: SelfUpdateDeps = {},
): Promise<{
  latestVersion: string | null;
  outdated: boolean;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const useCache = deps.useCache !== false;
  const ttlHours = deps.ttlHours ?? 24;
  const now = deps.now ?? Date.now;
  const resolveLatestVersion = deps.resolveLatestVersion ?? (async () => {
    const client = new NpmRegistryClient(cwd);
    return client.resolveLatestVersion(CLI_PACKAGE_NAME);
  });

  let latestVersion: string | null = null;
  let cache: VersionCache | null = null;
  try {
    if (useCache) {
      cache = await VersionCache.create();
      const cached = await cache.getValid(SELF_CACHE_KEY, "latest");
      if (cached?.latestVersion) {
        latestVersion = cached.latestVersion;
      }
    }
  } catch {
    warnings.push("Unable to read self-update cache; continuing with registry check.");
  }

  if (!latestVersion) {
    try {
      latestVersion = await resolveLatestVersion();
      if (latestVersion && useCache) {
        const activeCache = cache ?? await VersionCache.create();
        await activeCache.set(
          SELF_CACHE_KEY,
          "latest",
          latestVersion,
          [latestVersion],
          ttlHours * 3600,
        );
      }
    } catch (error) {
      warnings.push(`Unable to check latest CLI version: ${String(error)}`);
    }
  }

  const outdated = isOutdated(CLI_VERSION, latestVersion);
  return { latestVersion, outdated, warnings };
}

export function formatSelfUpdateNotice(result: SelfUpdateResult): string | null {
  if (!result.outdated || !result.latestVersion) return null;
  return [
    "Update available for Rainy Updates CLI",
    `Current: v${result.currentVersion}`,
    `Latest: v${result.latestVersion}`,
    `Update with: ${result.recommendedCommand}`,
  ].join("\n");
}

function isOutdated(currentVersion: string, latestVersion: string | null): boolean {
  if (!latestVersion) return false;
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);
  if (!current || !latest) return false;
  return compareVersions(latest, current) > 0;
}

function detectSelfUpdateChannel(): SelfUpdateChannel {
  const execPath = process.execPath ?? "";
  const scriptPath = process.argv[1] ?? "";
  const binaryName = /(?:^|\/)(rup|rainy-up|rainy-updates|rup-mcp)(?:\.exe)?$/i;
  if (
    binaryName.test(execPath) &&
    (scriptPath.length === 0 || !scriptPath.endsWith(".js"))
  ) {
    return "binary";
  }

  const manager = detectPreferredManager();
  if (manager === "bun") return "global-bun";
  if (manager === "pnpm") return "global-pnpm";
  return "global-npm";
}

function detectPreferredManager(): "bun" | "npm" | "pnpm" {
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.startsWith("bun/")) return "bun";
  if (userAgent.startsWith("pnpm/")) return "pnpm";
  if (userAgent.startsWith("npm/")) return "npm";

  if (typeof Bun !== "undefined" && Bun.which("bun")) return "bun";
  if (typeof Bun !== "undefined" && Bun.which("pnpm")) return "pnpm";
  return "npm";
}

function buildRecommendedCommand(
  channel: SelfUpdateChannel,
  manager: "bun" | "npm" | "pnpm",
): string | null {
  if (channel === "binary") {
    return "Download latest binary release from https://github.com/ferxalbs/rainy-updates/releases/latest";
  }
  if (manager === "bun") return "bun add -g @rainy-updates/cli@latest";
  if (manager === "pnpm") return "pnpm add -g @rainy-updates/cli@latest";
  return "npm install -g @rainy-updates/cli@latest";
}

async function executeCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<number> {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return proc.exited;
}
