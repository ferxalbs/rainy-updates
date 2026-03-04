import type { DashboardOptions } from "../types/index.js";

export const FILTER_ORDER = [
  "all",
  "security",
  "risky",
  "major",
  "peer-conflict",
  "license",
  "unused",
  "blocked",
] as const;

export const DETAIL_TABS = [
  "overview",
  "risk",
  "security",
  "peer",
  "license",
  "health",
  "changelog",
] as const;

export type DashboardFilterKey = (typeof FILTER_ORDER)[number];
export type DashboardDetailTab = (typeof DETAIL_TABS)[number];

export function deriveDashboardInitialFilter(
  options: Pick<DashboardOptions, "focus" | "view">,
): DashboardFilterKey {
  if (options.focus === "security") return "security";
  if (options.focus === "risk") return "risky";
  if (options.focus === "major") return "major";
  if (options.focus === "blocked") return "blocked";
  if (options.view === "security") return "security";
  if (options.view === "health") return "risky";
  return "all";
}

export function deriveDashboardInitialTab(
  options: Pick<DashboardOptions, "focus" | "view">,
): DashboardDetailTab {
  if (options.focus === "security" || options.view === "security") {
    return "security";
  }
  if (options.focus === "risk") return "risk";
  if (options.view === "health") return "health";
  return "overview";
}
