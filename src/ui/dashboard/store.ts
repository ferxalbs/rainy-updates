import { useSyncExternalStore } from "react";
import type {
  DashboardOptions,
  CheckResult,
  PackageUpdate,
  ResolveOptions,
  AuditOptions,
} from "../../types/index.js";
import { runResolve } from "../../commands/resolve/runner.js";
import { runAudit } from "../../commands/audit/runner.js";

// The state of our interactive dashboard
export interface DashboardState {
  selectedIndex: number;
  view: "dependencies" | "security" | "health";
  modal: "none" | "resolving" | "auditing" | "applying";
  updates: PackageUpdate[];
  summary: CheckResult["summary"];
  options: DashboardOptions; // stored to execute background tasks
  error?: string;
  shouldApply: boolean;
}

type Listener = () => void;

class DashboardStore {
  private state: DashboardState;
  private listeners: Set<Listener> = new Set();

  constructor(initialState: DashboardState) {
    this.state = initialState;
  }

  getState = () => this.state;

  setState = (
    partial:
      | Partial<DashboardState>
      | ((state: DashboardState) => Partial<DashboardState>),
  ) => {
    const changes =
      typeof partial === "function" ? partial(this.state) : partial;
    this.state = { ...this.state, ...changes };
    this.emit();
  };

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// Global singleton per run
let store: DashboardStore | null = null;

export function initStore(
  options: DashboardOptions,
  initialResult: CheckResult,
) {
  if (!store) {
    store = new DashboardStore({
      selectedIndex: 0,
      view: options.view ?? "dependencies",
      modal: "none",
      updates: initialResult.updates,
      summary: initialResult.summary,
      options,
      shouldApply: false,
    });
  }
  return store;
}

// Hook to use the store in components, taking a selector to prevent unnecessary re-renders
export function useDashboardStore<T>(
  selector: (state: DashboardState) => T,
): T {
  if (!store) throw new Error("Store not initialized");

  // Custom equality check could be added, but returning primitive/stable references from selector works best
  return useSyncExternalStore(store.subscribe, () =>
    selector(store!.getState()),
  );
}

// Export actions to modify state without re-rendering the caller
export const dashboardActions = {
  moveCursorUp: () => {
    store?.setState((s) => ({
      selectedIndex: Math.max(0, s.selectedIndex - 1),
    }));
  },
  moveCursorDown: () => {
    store?.setState((s) => ({
      selectedIndex: Math.min(s.updates.length - 1, s.selectedIndex + 1),
    }));
  },
  setView: (view: DashboardState["view"]) => {
    store?.setState({ view, selectedIndex: 0 }); // reset cursor on view change
  },
  setModal: (modal: DashboardState["modal"]) => {
    store?.setState({ modal });
  },
  setShouldApply: (shouldApply: boolean) => {
    store?.setState({ shouldApply });
  },
  runResolveAction: async () => {
    if (!store) return;
    const s = store.getState();
    store.setState({ modal: "resolving" });
    try {
      const resolveOpts: ResolveOptions = {
        cwd: s.options.cwd,
        workspace: s.options.workspace,
        afterUpdate: true,
        safe: true,
        concurrency: s.options.concurrency,
        registryTimeoutMs: s.options.registryTimeoutMs,
        cacheTtlSeconds: s.options.cacheTtlSeconds,
        silent: true,
      };

      const result = await runResolve(resolveOpts);

      // Update updates array with the conflict severity
      const updatedUpdates = s.updates.map((update) => {
        const hasError = result.conflicts.some(
          (c) => c.requester === update.name && c.severity === "error",
        );
        const hasWarning = result.conflicts.some(
          (c) => c.requester === update.name && c.severity === "warning",
        );
        const severity = (
          hasError ? "error" : hasWarning ? "warning" : "none"
        ) as "none" | "error" | "warning";
        return { ...update, peerConflictSeverity: severity };
      });

      store.setState({ updates: updatedUpdates });
    } catch (err) {
      store.setState({ error: String(err) });
    } finally {
      store.setState({ modal: "none" });
    }
  },
  runAuditAction: async () => {
    if (!store) return;
    const s = store.getState();
    store.setState({ modal: "auditing" });
    try {
      const auditOpts: AuditOptions = {
        cwd: s.options.cwd,
        workspace: s.options.workspace,
        fix: false,
        dryRun: false,
        commit: false,
        packageManager: "auto",
        reportFormat: "summary",
        sourceMode: "auto",
        concurrency: s.options.concurrency,
        registryTimeoutMs: s.options.registryTimeoutMs,
        silent: true,
      };

      const result = await runAudit(auditOpts);

      // Map advisories back to updates
      const updatedUpdates = s.updates.map((update) => {
        const pkgSummary = result.packages.find(
          (p) => p.packageName === update.name,
        );
        if (pkgSummary) {
          return {
            ...update,
            riskLevel: pkgSummary.severity,
            advisoryCount: pkgSummary.advisoryCount,
            toRange: pkgSummary.patchedVersion || update.toRange, // suggest the patch!
          };
        }
        return update;
      });

      store.setState({ updates: updatedUpdates });
    } catch (err) {
      store.setState({ error: String(err) });
    } finally {
      store.setState({ modal: "none" });
    }
  },
};

export function getStore() {
  return store;
}
