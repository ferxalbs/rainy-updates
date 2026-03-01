import type { DashboardOptions } from "../../types/index.js";

export function parseDashboardArgs(args: string[]): DashboardOptions {
  const options: DashboardOptions = {
    cwd: process.cwd(),
    target: "latest",
    includeKinds: [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ],
    cacheTtlSeconds: 3600,
    ci: false,
    format: "table",
    workspace: false,
    concurrency: 16,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    offline: false,
    stream: false,
    logLevel: "info",
    groupBy: "none",
    onlyChanged: false,
    ciProfile: "minimal",
    lockfileMode: "preserve",
    interactive: true,
    showImpact: false,
    showHomepage: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--view" && nextArg) {
      if (
        nextArg === "dependencies" ||
        nextArg === "security" ||
        nextArg === "health"
      ) {
        options.view = nextArg;
      } else {
        throw new Error(`Invalid --view: ${nextArg}`);
      }
      i++;
      continue;
    }
    if (arg === "--view") {
      throw new Error("Missing value for --view");
    }

    // Pass through common workspace / cwd args
    if (arg === "--workspace") {
      options.workspace = true;
      continue;
    }

    if (arg === "--cwd" && nextArg) {
      options.cwd = nextArg;
      i++;
      continue;
    }
  }

  return options;
}
