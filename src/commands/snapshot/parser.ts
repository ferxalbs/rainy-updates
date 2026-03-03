import type { SnapshotOptions, SnapshotAction } from "../../types/index.js";

const VALID_ACTIONS: SnapshotAction[] = ["save", "list", "restore", "diff"];

export function parseSnapshotArgs(args: string[]): SnapshotOptions {
  const options: SnapshotOptions = {
    cwd: process.cwd(),
    workspace: false,
    affected: false,
    staged: false,
    baseRef: undefined,
    headRef: undefined,
    sinceRef: undefined,
    action: "list",
    label: undefined,
    snapshotId: undefined,
    storeFile: undefined,
  };

  // First positional arg is the action
  let positionalIndex = 0;
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    const next = args[i + 1];

    if (current === "--cwd" && next) {
      options.cwd = next;
      i++;
      continue;
    }
    if (current === "--cwd") throw new Error("Missing value for --cwd");

    if (current === "--workspace") {
      options.workspace = true;
      continue;
    }
    if (current === "--affected") {
      options.affected = true;
      continue;
    }
    if (current === "--staged") {
      options.staged = true;
      continue;
    }
    if (current === "--base" && next) {
      options.baseRef = next;
      i++;
      continue;
    }
    if (current === "--base") throw new Error("Missing value for --base");
    if (current === "--head" && next) {
      options.headRef = next;
      i++;
      continue;
    }
    if (current === "--head") throw new Error("Missing value for --head");
    if (current === "--since" && next) {
      options.sinceRef = next;
      i++;
      continue;
    }
    if (current === "--since") throw new Error("Missing value for --since");

    if (current === "--label" && next) {
      options.label = next;
      i++;
      continue;
    }
    if (current === "--label") throw new Error("Missing value for --label");

    if (current === "--store" && next) {
      options.storeFile = next;
      i++;
      continue;
    }
    if (current === "--store") throw new Error("Missing value for --store");

    if (current === "--help" || current === "-h") {
      process.stdout.write(SNAPSHOT_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) throw new Error(`Unknown option: ${current}`);

    // Positional arguments
    positionals.push(current);
  }

  // positionals[0] = action, positionals[1] = id/label for restore/diff
  if (positionals.length >= 1) {
    const action = positionals[0] as SnapshotAction;
    if (!VALID_ACTIONS.includes(action)) {
      throw new Error(
        `Unknown snapshot action: "${positionals[0]}". Valid: ${VALID_ACTIONS.join(", ")}`,
      );
    }
    options.action = action;
  }

  if (positionals.length >= 2) {
    // For restore/diff the second positional is the id/label
    options.snapshotId = positionals[1];
  }

  return options;
}

const SNAPSHOT_HELP = `
rup snapshot — Save, list, restore, and diff dependency state snapshots

Usage:
  rup snapshot save [--label <name>]    Save current dependency state
  rup snapshot list                     List all saved snapshots
  rup snapshot restore <id|label>       Restore package.json files from a snapshot
  rup snapshot diff <id|label>          Show changes since a snapshot

Options:
  --label <name>        Human-readable label for the snapshot
  --store <path>        Custom snapshot store file (default: .rup-snapshots.json)
  --workspace           Include all workspace packages
  --affected            Include changed workspace packages and dependents
  --staged              Limit snapshot scope to staged changes
  --base <ref>          Compare changes against a base git ref
  --head <ref>          Compare changes against a head git ref
  --since <ref>         Compare changes since a git ref
  --cwd <path>          Working directory (default: cwd)
  --help                Show this help
`.trimStart();
