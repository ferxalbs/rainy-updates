import React, { useState } from "react";
import { Box, render, Text, useInput } from "ink";
import type { DecisionState, ReviewItem } from "../types/index.js";

const FILTER_ORDER = [
  "all",
  "security",
  "risky",
  "major",
  "peer-conflict",
  "license",
  "unused",
  "blocked",
] as const;
type FilterKey = (typeof FILTER_ORDER)[number];

const SORT_ORDER = ["risk", "advisories", "diff", "name", "workspace"] as const;
type SortKey = (typeof SORT_ORDER)[number];

const GROUP_ORDER = ["none", "workspace", "scope", "risk", "decision"] as const;
type GroupKey = (typeof GROUP_ORDER)[number];

const DETAIL_TABS = [
  "overview",
  "risk",
  "security",
  "peer",
  "license",
  "health",
  "changelog",
] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

interface TuiAppProps {
  items: ReviewItem[];
  title?: string;
  subtitle?: string;
  onComplete: (selected: ReviewItem[]) => void;
}

interface VisibleRow {
  kind: "group" | "item";
  label: string;
  index?: number;
}

interface TuiState {
  cursorIndex: number;
  filterIndex: number;
  sortIndex: number;
  groupIndex: number;
  tabIndex: number;
  showHelp: boolean;
  searchMode: boolean;
  search: string;
  selectedIndices: Set<number>;
}

type TuiAction =
  | { type: "SET_SEARCH_MODE"; active: boolean }
  | { type: "SET_SEARCH"; value: string }
  | { type: "APPEND_SEARCH"; value: string }
  | { type: "BACKSPACE_SEARCH" }
  | { type: "TOGGLE_HELP" }
  | { type: "SET_HELP"; active: boolean }
  | { type: "MOVE_FILTER"; direction: 1 | -1; max: number }
  | { type: "MOVE_CURSOR"; direction: 1 | -1; max: number }
  | { type: "RESET_CURSOR" }
  | { type: "CYCLE_SORT"; max: number }
  | { type: "CYCLE_GROUP"; max: number }
  | { type: "CYCLE_TAB"; max: number }
  | { type: "SET_SELECTED"; indices: Set<number> }
  | { type: "TOGGLE_SELECTED"; index: number };

function tuiReducer(state: TuiState, action: TuiAction): TuiState {
  switch (action.type) {
    case "SET_SEARCH_MODE":
      return {
        ...state,
        searchMode: action.active,
        ...(action.active ? {} : { search: "", cursorIndex: 0 }),
      };
    case "SET_SEARCH":
      return { ...state, search: action.value, cursorIndex: 0 };
    case "APPEND_SEARCH":
      return { ...state, search: state.search + action.value, cursorIndex: 0 };
    case "BACKSPACE_SEARCH":
      return { ...state, search: state.search.slice(0, -1), cursorIndex: 0 };
    case "TOGGLE_HELP":
      return { ...state, showHelp: !state.showHelp };
    case "SET_HELP":
      return { ...state, showHelp: action.active };
    case "MOVE_FILTER":
      return {
        ...state,
        filterIndex: Math.min(
          action.max,
          Math.max(0, state.filterIndex + action.direction),
        ),
        cursorIndex: 0,
      };
    case "MOVE_CURSOR":
      return {
        ...state,
        cursorIndex: Math.min(
          action.max,
          Math.max(0, state.cursorIndex + action.direction),
        ),
      };
    case "RESET_CURSOR":
      return { ...state, cursorIndex: 0 };
    case "CYCLE_SORT":
      return {
        ...state,
        sortIndex: (state.sortIndex + 1) % action.max,
        cursorIndex: 0,
      };
    case "CYCLE_GROUP":
      return {
        ...state,
        groupIndex: (state.groupIndex + 1) % action.max,
        cursorIndex: 0,
      };
    case "CYCLE_TAB":
      return { ...state, tabIndex: (state.tabIndex + 1) % action.max };
    case "SET_SELECTED":
      return { ...state, selectedIndices: action.indices };
    case "TOGGLE_SELECTED": {
      const next = new Set(state.selectedIndices);
      if (next.has(action.index)) next.delete(action.index);
      else next.add(action.index);
      return { ...state, selectedIndices: next };
    }
    default:
      return state;
  }
}

function TuiApp({ items, title, subtitle, onComplete }: TuiAppProps) {
  const [state, dispatch] = React.useReducer(tuiReducer, undefined, () => ({
    cursorIndex: 0,
    filterIndex: 0,
    sortIndex: 0,
    groupIndex: 0,
    tabIndex: 0,
    showHelp: false,
    searchMode: false,
    search: "",
    selectedIndices: new Set(
      items.flatMap((item, index) =>
        item.update.selectedByDefault === false ? [] : [index],
      ),
    ),
  }));

  const activeFilter = FILTER_ORDER[state.filterIndex] ?? "all";
  const activeSort = SORT_ORDER[state.sortIndex] ?? "risk";
  const activeGroup = GROUP_ORDER[state.groupIndex] ?? "none";
  const activeTab = DETAIL_TABS[state.tabIndex] ?? "overview";
  const searchMode = state.searchMode;
  const search = state.search;
  const showHelp = state.showHelp;
  const selectedIndices = state.selectedIndices;
  const filterIndex = state.filterIndex;

  const visibleRows = buildVisibleRows(items, {
    filter: activeFilter,
    sort: activeSort,
    group: activeGroup,
    search,
  });
  const itemRows = visibleRows.filter(
    (row): row is VisibleRow & { index: number } =>
      row.kind === "item" && typeof row.index === "number",
  );
  const boundedCursor = Math.min(
    state.cursorIndex,
    Math.max(0, itemRows.length - 1),
  );
  const focusedIndex = itemRows[boundedCursor]?.index ?? 0;
  const focusedItem = items[focusedIndex];

  useInput((input, key) => {
    if (searchMode) {
      if (key.escape) {
        dispatch({ type: "SET_SEARCH_MODE", active: false });
        return;
      }
      if (key.return) {
        dispatch({ type: "SET_SEARCH_MODE", active: false });
        dispatch({ type: "SET_SEARCH", value: search }); // keeps search but exits mode
        return;
      }
      if (key.backspace || key.delete) {
        dispatch({ type: "BACKSPACE_SEARCH" });
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        dispatch({ type: "APPEND_SEARCH", value: input });
      }
      return;
    }

    if (input === "/") {
      dispatch({ type: "SET_SEARCH_MODE", active: true });
      return;
    }
    if (input === "?") {
      dispatch({ type: "TOGGLE_HELP" });
      return;
    }
    if (key.escape && showHelp) {
      dispatch({ type: "SET_HELP", active: false });
      return;
    }
    if (key.leftArrow) {
      dispatch({
        type: "MOVE_FILTER",
        direction: -1,
        max: FILTER_ORDER.length - 1,
      });
    }
    if (key.rightArrow) {
      dispatch({
        type: "MOVE_FILTER",
        direction: 1,
        max: FILTER_ORDER.length - 1,
      });
    }
    if (key.upArrow) {
      dispatch({
        type: "MOVE_CURSOR",
        direction: -1,
        max: itemRows.length - 1,
      });
    }
    if (key.downArrow) {
      dispatch({ type: "MOVE_CURSOR", direction: 1, max: itemRows.length - 1 });
    }
    if (input === "o") {
      dispatch({ type: "CYCLE_SORT", max: SORT_ORDER.length });
    }
    if (input === "g") {
      dispatch({ type: "CYCLE_GROUP", max: GROUP_ORDER.length });
    }
    if (key.tab) {
      dispatch({ type: "CYCLE_TAB", max: DETAIL_TABS.length });
    }
    if (input === "a") {
      dispatch({
        type: "SET_SELECTED",
        indices: addVisible(selectedIndices, itemRows),
      });
    }
    if (input === "n") {
      dispatch({
        type: "SET_SELECTED",
        indices: removeVisible(selectedIndices, itemRows),
      });
    }
    if (input === "s") {
      dispatch({
        type: "SET_SELECTED",
        indices: selectSafe(selectedIndices, itemRows, items),
      });
    }
    if (input === "b") {
      dispatch({
        type: "SET_SELECTED",
        indices: clearBlocked(selectedIndices, itemRows, items),
      });
    }
    if (input === " ") {
      dispatch({ type: "TOGGLE_SELECTED", index: focusedIndex });
    }
    if (input === "q" || key.escape) {
      onComplete(items.filter((_, index) => selectedIndices.has(index)));
      return;
    }
    if (key.return) {
      onComplete(items.filter((_, index) => selectedIndices.has(index)));
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        {title ?? "Rainy Dashboard"}
      </Text>
      <Text color="gray">
        {subtitle ??
          "Check detects, doctor summarizes, dashboard decides, upgrade applies."}
      </Text>
      <Text color="gray">
        Filters: ←/→ Sort: o Group: g Tabs: Tab Search: / Help: ? Space: toggle
        Enter: confirm
      </Text>

      <Box marginTop={1} flexDirection="row">
        <Box
          width={24}
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold>Filter Rail</Text>
          {FILTER_ORDER.map((filter, index) => (
            <Text key={filter} color={index === filterIndex ? "cyan" : "gray"}>
              {index === filterIndex ? ">" : " "} {filter}
            </Text>
          ))}
          <Box marginTop={1} flexDirection="column">
            <Text bold>Search</Text>
            <Text color={searchMode ? "cyan" : "gray"}>
              {searchMode ? `/${search}` : search ? `/${search}` : "inactive"}
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text bold>Modes</Text>
            <Text color="gray">sort: {activeSort}</Text>
            <Text color="gray">group: {activeGroup}</Text>
            <Text color="gray">tab: {activeTab}</Text>
          </Box>
        </Box>

        <Box
          marginLeft={1}
          width={82}
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold>Review Queue</Text>
          {itemRows.length === 0 ? (
            <Text color="gray">No review candidates match this view.</Text>
          ) : (
            visibleRows.map((row, visibleIndex) => {
              if (row.kind === "group") {
                return (
                  <Text key={`group:${row.label}`} bold color="gray">
                    {row.label}
                  </Text>
                );
              }
              const index = row.index ?? 0;
              const item = items[index];
              const update = item.update;
              const decision = update.decisionState ?? deriveDecision(item);
              const itemPosition = itemRows.findIndex(
                (candidate) => candidate.index === index,
              );
              const isFocused = itemPosition === boundedCursor;
              const isSelected = selectedIndices.has(index);
              return (
                <Box
                  key={`${update.packagePath}:${update.name}`}
                  flexDirection="row"
                >
                  <Text color={isFocused ? "cyan" : "gray"}>
                    {isFocused ? ">" : " "} {isSelected ? "[x]" : "[ ]"}{" "}
                  </Text>
                  <Box width={22}>
                    <Text bold={isFocused}>{update.name}</Text>
                  </Box>
                  <Box width={14}>
                    <Text color={diffColor(update.diffType)}>
                      {update.diffType}
                    </Text>
                  </Box>
                  <Box width={14}>
                    <Text color={riskColor(update.riskLevel)}>
                      {update.riskLevel ?? "low"}
                    </Text>
                  </Box>
                  <Box width={14}>
                    <Text color={decisionColor(decision)}>{decision}</Text>
                  </Box>
                  <Box width={10}>
                    <Text color={decisionColor(decision)}>
                      {update.riskScore ?? "--"}
                    </Text>
                  </Box>
                  <Text color="gray">{update.fromRange}</Text>
                  <Text color="gray"> → </Text>
                  <Text color="green">{update.toVersionResolved}</Text>
                </Box>
              );
            })
          )}
        </Box>

        <Box
          marginLeft={1}
          width={54}
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold>Decision Panel</Text>
          <Text color="gray">tab: {activeTab}</Text>
          {focusedItem ? (
            renderTab(focusedItem, activeTab)
          ) : (
            <Text color="gray">No review candidate selected.</Text>
          )}
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">
          {selectedIndices.size} selected of {items.length}. view={activeFilter}{" "}
          sort={activeSort} group={activeGroup}
        </Text>
      </Box>

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">
          A select visible N clear visible S select safe B clear blocked Q
          finish Esc clears search/help
        </Text>
      </Box>

      {showHelp ? (
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          flexDirection="column"
        >
          <Text bold>Help</Text>
          <Text color="gray">
            Use review as the decision center. Search packages with / and
            inspect details with Tab.
          </Text>
          <Text color="gray">
            Blocked items default to deselected. Safe items can be bulk-selected
            with S.
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

function renderTab(item: ReviewItem, tab: DetailTab): React.JSX.Element {
  const update = item.update;
  if (tab === "risk") {
    return (
      <>
        <Text>
          state:{" "}
          <Text
            color={decisionColor(update.decisionState ?? deriveDecision(item))}
          >
            {update.decisionState ?? deriveDecision(item)}
          </Text>
        </Text>
        <Text>
          policy:{" "}
          <Text color={decisionColor(policyToDecision(update.policyAction))}>
            {update.policyAction ?? "allow"}
          </Text>
        </Text>
        <Text>risk score: {update.riskScore ?? 0}</Text>
        <Text>impact score: {update.impactScore?.score ?? 0}</Text>
        <Text>
          recommended action:{" "}
          {update.recommendedAction ?? "Safe to keep in the selected set."}
        </Text>
        {update.riskReasons && update.riskReasons.length > 0 ? (
          update.riskReasons.slice(0, 5).map((reason) => (
            <Text key={reason} color="gray">
              - {reason}
            </Text>
          ))
        ) : (
          <Text color="gray">No elevated risk reasons.</Text>
        )}
      </>
    );
  }
  if (tab === "security") {
    return (
      <>
        <Text>advisories: {item.advisories.length}</Text>
        {item.advisories.length > 0 ? (
          item.advisories.slice(0, 4).map((advisory) => (
            <Text
              key={`${advisory.packageName}:${advisory.cveId}`}
              color="gray"
            >
              - {advisory.severity} {advisory.cveId}: {advisory.title}
            </Text>
          ))
        ) : (
          <Text color="gray">No security advisories detected.</Text>
        )}
      </>
    );
  }
  if (tab === "peer") {
    return (
      <>
        <Text>peer status: {update.peerConflictSeverity ?? "none"}</Text>
        {item.peerConflicts.length > 0 ? (
          item.peerConflicts.slice(0, 4).map((conflict) => (
            <Text key={`${conflict.requester}:${conflict.peer}`} color="gray">
              - {conflict.requester} requires {conflict.peer}{" "}
              {conflict.requiredRange}
            </Text>
          ))
        ) : (
          <Text color="gray">No peer conflicts detected.</Text>
        )}
      </>
    );
  }
  if (tab === "license") {
    return (
      <>
        <Text>license status: {update.licenseStatus ?? "allowed"}</Text>
        <Text>repository: {update.repository ?? "unavailable"}</Text>
        <Text>homepage: {update.homepage ?? "unavailable"}</Text>
      </>
    );
  }
  if (tab === "health") {
    return (
      <>
        <Text>health: {update.healthStatus ?? "healthy"}</Text>
        <Text>maintainers: {update.maintainerCount ?? "unknown"}</Text>
        <Text>publish age days: {update.publishAgeDays ?? "unknown"}</Text>
        <Text>maintainer churn: {update.maintainerChurn ?? "unknown"}</Text>
      </>
    );
  }
  if (tab === "changelog") {
    return (
      <>
        <Text>
          {update.releaseNotesSummary?.title ?? "Release notes unavailable"}
        </Text>
        <Text color="gray">
          {update.releaseNotesSummary?.excerpt ??
            "Run review with changelog support or inspect the repository manually."}
        </Text>
      </>
    );
  }
  return (
    <>
      <Text>{update.name}</Text>
      <Text color="gray">package: {update.packagePath}</Text>
      <Text>
        state:{" "}
        <Text
          color={decisionColor(update.decisionState ?? deriveDecision(item))}
        >
          {update.decisionState ?? deriveDecision(item)}
        </Text>
      </Text>
      <Text>
        diff: <Text color={diffColor(update.diffType)}>{update.diffType}</Text>
      </Text>
      <Text>
        risk:{" "}
        <Text color={riskColor(update.riskLevel)}>
          {update.riskLevel ?? "low"}
        </Text>
      </Text>
      <Text>policy: {update.policyAction ?? "allow"}</Text>
      <Text>workspace: {update.workspaceGroup ?? "root"}</Text>
      <Text>group: {update.groupKey ?? "none"}</Text>
      <Text>
        action:{" "}
        {update.recommendedAction ?? "Safe to keep in the selected set."}
      </Text>
    </>
  );
}

function buildVisibleRows(
  items: ReviewItem[],
  config: { filter: FilterKey; sort: SortKey; group: GroupKey; search: string },
): VisibleRow[] {
  const filtered = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => matchesFilter(item, config.filter))
    .filter(({ item }) => matchesSearch(item, config.search))
    .sort((left, right) => compareItems(left.item, right.item, config.sort));

  if (config.group === "none") {
    return filtered.map(({ item, index }) => ({
      kind: "item",
      label: item.update.name,
      index,
    }));
  }

  const rows: VisibleRow[] = [];
  let currentGroup = "";
  for (const entry of filtered) {
    const nextGroup = groupLabel(entry.item, config.group);
    if (nextGroup !== currentGroup) {
      currentGroup = nextGroup;
      rows.push({ kind: "group", label: nextGroup });
    }
    rows.push({
      kind: "item",
      label: entry.item.update.name,
      index: entry.index,
    });
  }
  return rows;
}

function matchesFilter(item: ReviewItem, filter: FilterKey): boolean {
  if (filter === "security") return item.advisories.length > 0;
  if (filter === "risky")
    return (
      item.update.riskLevel === "critical" || item.update.riskLevel === "high"
    );
  if (filter === "major") return item.update.diffType === "major";
  if (filter === "peer-conflict") return item.peerConflicts.length > 0;
  if (filter === "license") return item.update.licenseStatus === "denied";
  if (filter === "unused") return item.unusedIssues.length > 0;
  if (filter === "blocked")
    return (item.update.decisionState ?? deriveDecision(item)) === "blocked";
  return true;
}

function matchesSearch(item: ReviewItem, search: string): boolean {
  if (!search.trim()) return true;
  const query = search.toLowerCase();
  return (
    item.update.name.toLowerCase().includes(query) ||
    item.update.packagePath.toLowerCase().includes(query)
  );
}

function compareItems(
  left: ReviewItem,
  right: ReviewItem,
  sort: SortKey,
): number {
  if (sort === "advisories") {
    const byAdvisories =
      (right.advisories.length ?? 0) - (left.advisories.length ?? 0);
    if (byAdvisories !== 0) return byAdvisories;
  }
  if (sort === "diff") {
    const byDiff =
      diffWeight(right.update.diffType) - diffWeight(left.update.diffType);
    if (byDiff !== 0) return byDiff;
  }
  if (sort === "workspace") {
    const byWorkspace = (
      left.update.workspaceGroup ?? left.update.packagePath
    ).localeCompare(right.update.workspaceGroup ?? right.update.packagePath);
    if (byWorkspace !== 0) return byWorkspace;
  }
  if (sort === "name") {
    const byName = left.update.name.localeCompare(right.update.name);
    if (byName !== 0) return byName;
  }
  const byRisk = (right.update.riskScore ?? 0) - (left.update.riskScore ?? 0);
  if (byRisk !== 0) return byRisk;
  return left.update.name.localeCompare(right.update.name);
}

function groupLabel(item: ReviewItem, group: GroupKey): string {
  if (group === "workspace") return item.update.workspaceGroup ?? "root";
  if (group === "scope") {
    if (item.update.name.startsWith("@")) {
      return item.update.name.split("/")[0] ?? "unscoped";
    }
    return "unscoped";
  }
  if (group === "risk") return item.update.riskLevel ?? "low";
  if (group === "decision")
    return item.update.decisionState ?? deriveDecision(item);
  return "all";
}

function addVisible(
  selected: Set<number>,
  rows: Array<VisibleRow & { index: number }>,
): Set<number> {
  const next = new Set(selected);
  for (const row of rows) next.add(row.index);
  return next;
}

function removeVisible(
  selected: Set<number>,
  rows: Array<VisibleRow & { index: number }>,
): Set<number> {
  const next = new Set(selected);
  for (const row of rows) next.delete(row.index);
  return next;
}

function selectSafe(
  selected: Set<number>,
  rows: Array<VisibleRow & { index: number }>,
  items: ReviewItem[],
): Set<number> {
  const next = new Set(selected);
  for (const row of rows) {
    if (
      (items[row.index]?.update.decisionState ??
        deriveDecision(items[row.index]!)) === "safe"
    ) {
      next.add(row.index);
    }
  }
  return next;
}

function clearBlocked(
  selected: Set<number>,
  rows: Array<VisibleRow & { index: number }>,
  items: ReviewItem[],
): Set<number> {
  const next = new Set(selected);
  for (const row of rows) {
    if (
      (items[row.index]?.update.decisionState ??
        deriveDecision(items[row.index]!)) === "blocked"
    ) {
      next.delete(row.index);
    }
  }
  return next;
}

function deriveDecision(item: ReviewItem): DecisionState {
  if (
    item.update.peerConflictSeverity === "error" ||
    item.update.licenseStatus === "denied"
  ) {
    return "blocked";
  }
  if (
    (item.update.advisoryCount ?? 0) > 0 ||
    item.update.riskLevel === "critical"
  ) {
    return "actionable";
  }
  if (item.update.riskLevel === "high" || item.update.diffType === "major") {
    return "review";
  }
  return "safe";
}

function policyToDecision(
  value: ReviewItem["update"]["policyAction"],
): DecisionState {
  if (value === "block") return "blocked";
  if (value === "review") return "review";
  return "safe";
}

function riskColor(level: ReviewItem["update"]["riskLevel"]): string {
  switch (level) {
    case "critical":
      return "red";
    case "high":
      return "yellow";
    case "medium":
      return "cyan";
    default:
      return "green";
  }
}

function diffColor(level: ReviewItem["update"]["diffType"]): string {
  switch (level) {
    case "major":
      return "red";
    case "minor":
      return "yellow";
    case "patch":
      return "green";
    default:
      return "cyan";
  }
}

function diffWeight(level: ReviewItem["update"]["diffType"]): number {
  if (level === "major") return 4;
  if (level === "minor") return 3;
  if (level === "patch") return 2;
  return 1;
}

function decisionColor(label: DecisionState): string {
  switch (label) {
    case "blocked":
      return "red";
    case "actionable":
      return "yellow";
    case "review":
      return "cyan";
    default:
      return "green";
  }
}

export async function runTui(
  items: ReviewItem[],
  options?: { title?: string; subtitle?: string },
): Promise<ReviewItem[]> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <TuiApp
        items={items}
        title={options?.title}
        subtitle={options?.subtitle}
        onComplete={(selected) => {
          unmount();
          resolve(selected);
        }}
      />,
    );
  });
}
