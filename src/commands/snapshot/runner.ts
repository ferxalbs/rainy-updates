import process from "node:process";
import type { SnapshotOptions, SnapshotResult } from "../../types/index.js";
import { discoverPackageDirs } from "../../workspace/discover.js";
import {
  SnapshotStore,
  captureState,
  restoreState,
  diffManifests,
} from "./store.js";

/**
 * Entry point for `rup snapshot`. Lazy-loaded by cli.ts.
 *
 * Actions:
 *   save     — Capture package.json + lockfile state → store
 *   list     — Print all saved snapshots
 *   restore  — Restore a snapshot by id or label
 *   diff     — Show dependency changes since a snapshot
 */
export async function runSnapshot(
  options: SnapshotOptions,
): Promise<SnapshotResult> {
  const result: SnapshotResult = {
    action: options.action,
    errors: [],
    warnings: [],
  };

  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace);
  const store = new SnapshotStore(options.cwd, options.storeFile);

  switch (options.action) {
    // ─ save ──────────────────────────────────────────────────────────────────
    case "save": {
      const label =
        options.label ??
        `snap-${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19)}`;
      const { manifests, lockfileHashes } = await captureState(packageDirs);
      const entry = await store.saveSnapshot(manifests, lockfileHashes, label);
      result.snapshotId = entry.id;
      result.label = entry.label;
      process.stdout.write(`✔ Snapshot saved: ${entry.label} (${entry.id})\n`);
      break;
    }

    // ─ list ──────────────────────────────────────────────────────────────────
    case "list": {
      const entries = await store.listSnapshots();
      result.entries = entries.map((e) => ({
        id: e.id,
        label: e.label,
        createdAt: new Date(e.createdAt).toISOString(),
      }));

      if (entries.length === 0) {
        process.stdout.write(
          "No snapshots saved yet. Use `rup snapshot save` to create one.\n",
        );
      } else {
        process.stdout.write(`\n${entries.length} snapshot(s):\n\n`);
        process.stdout.write(
          "  " + "ID".padEnd(30) + "Label".padEnd(30) + "Created\n",
        );
        process.stdout.write("  " + "─".repeat(75) + "\n");
        for (const e of entries) {
          process.stdout.write(
            "  " +
              e.id.padEnd(30) +
              e.label.padEnd(30) +
              new Date(e.createdAt).toLocaleString() +
              "\n",
          );
        }
        process.stdout.write("\n");
      }
      break;
    }

    // ─ restore ───────────────────────────────────────────────────────────────
    case "restore": {
      const idOrLabel = options.snapshotId ?? options.label;
      if (!idOrLabel) {
        result.errors.push(
          "Restore requires a snapshot ID or label. Usage: rup snapshot restore <id|label>",
        );
        break;
      }
      const entry = await store.findSnapshot(idOrLabel);
      if (!entry) {
        result.errors.push(
          `Snapshot not found: ${idOrLabel}. Use \`rup snapshot list\` to view saved snapshots.`,
        );
        break;
      }
      await restoreState(entry);
      result.snapshotId = entry.id;
      result.label = entry.label;
      const count = Object.keys(entry.manifests).length;
      process.stdout.write(
        `✔ Restored ${count} package.json file(s) from snapshot "${entry.label}" (${entry.id})\n`,
      );
      process.stdout.write("  Re-run your package manager install to apply.\n");
      break;
    }

    // ─ diff ──────────────────────────────────────────────────────────────────
    case "diff": {
      const idOrLabel = options.snapshotId ?? options.label;
      if (!idOrLabel) {
        result.errors.push(
          "Diff requires a snapshot ID or label. Usage: rup snapshot diff <id|label>",
        );
        break;
      }
      const entry = await store.findSnapshot(idOrLabel);
      if (!entry) {
        result.errors.push(`Snapshot not found: ${idOrLabel}`);
        break;
      }
      const { manifests: currentManifests } = await captureState(packageDirs);
      const changes = diffManifests(entry.manifests, currentManifests);
      result.diff = changes;

      if (changes.length === 0) {
        process.stdout.write(
          `✔ No dependency changes since snapshot "${entry.label}"\n`,
        );
      } else {
        process.stdout.write(
          `\nDependency changes since snapshot "${entry.label}":\n\n`,
        );
        process.stdout.write(
          "  " + "Package".padEnd(35) + "Before".padEnd(20) + "After\n",
        );
        process.stdout.write("  " + "─".repeat(65) + "\n");
        for (const c of changes) {
          process.stdout.write(
            "  " + c.name.padEnd(35) + c.from.padEnd(20) + c.to + "\n",
          );
        }
        process.stdout.write("\n");
      }
      break;
    }
  }

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      process.stderr.write(`[snapshot] ✖ ${err}\n`);
    }
  }

  return result;
}
