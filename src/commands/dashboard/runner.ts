import React from "react";
import { render } from "ink";
import type { DashboardOptions, DashboardResult } from "../../types/index.js";
import { loadConfig } from "../../config/loader.js";
import { DashboardTUI } from "../../ui/dashboard/DashboardTUI.js";

// We'll need to load initial state or data before or during the render
import { check } from "../../core/check.js";

export async function runDashboard(
  options: DashboardOptions,
): Promise<DashboardResult> {
  // Load configuration
  const resolvedConfig = await loadConfig(options.cwd);

  // Create an initial check result. In a real scenario, this could run
  // progressively in the TUI, but for simplicity we fetch initial data first.
  const checkResult = await check({
    ...options,
    // We do not want `check` to exit or log heavily here, the UI will take over.
    logLevel: "error",
  });

  // Render the interactive Ink Dashboard
  const { waitUntilExit } = render(
    React.createElement(DashboardTUI, {
      options,
      initialResult: checkResult,
    }),
  );

  await waitUntilExit();

  const finalStore = await import("../../ui/dashboard/store.js");
  const finalState = finalStore.getStore()?.getState();

  if (finalState?.shouldApply) {
    process.stderr.write("[dashboard] Applying updates...\n");
    const { applySelectedUpdates } = await import("../../core/upgrade.js");
    const { detectPackageManager } = await import("../../pm/detect.js");
    const { installDependencies } = await import("../../pm/install.js");

    await applySelectedUpdates(
      {
        ...options,
        install: false, // We handle installation explicitly below
        packageManager: "auto",
        sync: true,
        lockfileMode: options.lockfileMode || "preserve",
      },
      finalState.updates,
    );

    // Install using the correct package manager if desired
    const detected = await detectPackageManager(options.cwd);
    await installDependencies(options.cwd, "auto", detected);
    process.stderr.write(
      "[dashboard] Successfully applied updates and installed dependencies.\n",
    );
  }

  return {
    completed: true,
    errors: [],
    warnings: [],
  };
}
