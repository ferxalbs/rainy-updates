import React from "react";
import { Box, render, Text, useInput, useStdout } from "ink";
import type { DecisionState, ReviewItem } from "../types/index.js";
import {
  DETAIL_TABS,
  FILTER_ORDER,
  type DashboardDetailTab,
  type DashboardFilterKey,
} from "./dashboard-state.js";

const SORT_ORDER = ["risk", "advisories", "diff", "name", "workspace"] as const;
type SortKey = (typeof SORT_ORDER)[number];

const GROUP_ORDER = ["none", "workspace", "scope", "risk", "decision"] as const;
type GroupKey = (typeof GROUP_ORDER)[number];

interface TuiAppProps {
  items: ReviewItem[];
  title?: string;
  subtitle?: string;
  initialFilter?: DashboardFilterKey;
  initialTab?: DashboardDetailTab;
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
  | { type: "APPEND_SEARCH"; value: string }
  | { type: "BACKSPACE_SEARCH" }
  | { type: "TOGGLE_HELP" }
  | { type: "SET_HELP"; active: boolean }
  | { type: "MOVE_FILTER"; direction: 1 | -1; max: number }
  | { type: "MOVE_CURSOR"; direction: 1 | -1; max: number }
  | { type: "CYCLE_SORT"; max: number }
  | { type: "CYCLE_GROUP"; max: number }
  | { type: "CYCLE_TAB"; direction: 1 | -1; max: number }
  | { type: "SET_SELECTED"; indices: Set<number> }
  | { type: "TOGGLE_SELECTED"; index: number };

interface DashboardMetrics {
  total: number;
  selected: number;
  actionable: number;
  blocked: number;
  security: number;
}

interface RenderWindow {
  rows: VisibleRow[];
  start: number;
  end: number;
}

interface DashboardLayout {
  railWidth: number;
  detailWidth: number;
  queueWidth: number;
}

function tuiReducer(state: TuiState, action: TuiAction): TuiState {
  switch (action.type) {
    case "SET_SEARCH_MODE":
      return {
        ...state,
        searchMode: action.active,
        ...(action.active ? {} : { search: "", cursorIndex: 0 }),
      };
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
    case "CYCLE_TAB": {
      const next = (state.tabIndex + action.direction + action.max) % action.max;
      return { ...state, tabIndex: next };
    }
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

function TuiApp({
  items,
  title,
  subtitle,
  initialFilter = "all",
  initialTab = "overview",
  onComplete,
}: TuiAppProps) {
  const { stdout } = useStdout();
  const { columns: stdoutWidth = 160, rows: stdoutHeight = 32 } = stdout;
  const [state, dispatch] = React.useReducer(tuiReducer, undefined, () => ({
    cursorIndex: 0,
    filterIndex: Math.max(0, FILTER_ORDER.indexOf(initialFilter)),
    sortIndex: 0,
    groupIndex: 0,
    tabIndex: Math.max(0, DETAIL_TABS.indexOf(initialTab)),
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
  const visibleRows = buildVisibleRows(items, {
    filter: activeFilter,
    sort: activeSort,
    group: activeGroup,
    search: state.search,
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
  const visibleMetrics = summarizeVisibleItems(itemRows, items, state.selectedIndices);
  const renderWindow = createRenderWindow({
    visibleRows,
    focusedIndex,
    stdoutHeight,
  });
  const rowPositionByIndex = createRowPositionMap(itemRows);
  const layout = createDashboardLayout(stdoutWidth);
  const platformLabel = process.platform === "win32" ? "windows" : "unix";
  const selectedItems = items.filter((_, index) => state.selectedIndices.has(index));

  useInput((input, key) => {
    if (state.searchMode) {
      if (key.escape) {
        dispatch({ type: "SET_SEARCH_MODE", active: false });
        return;
      }
      if (key.return) {
        dispatch({ type: "SET_SEARCH_MODE", active: false });
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
    if (key.escape && state.showHelp) {
      dispatch({ type: "SET_HELP", active: false });
      return;
    }
    if (key.leftArrow || input === "h") {
      dispatch({
        type: "MOVE_FILTER",
        direction: -1,
        max: FILTER_ORDER.length - 1,
      });
      return;
    }
    if (key.rightArrow || input === "l") {
      dispatch({
        type: "MOVE_FILTER",
        direction: 1,
        max: FILTER_ORDER.length - 1,
      });
      return;
    }
    if (key.upArrow || input === "k") {
      dispatch({
        type: "MOVE_CURSOR",
        direction: -1,
        max: itemRows.length - 1,
      });
      return;
    }
    if (key.downArrow || input === "j") {
      dispatch({
        type: "MOVE_CURSOR",
        direction: 1,
        max: itemRows.length - 1,
      });
      return;
    }
    if (input === "o") {
      dispatch({ type: "CYCLE_SORT", max: SORT_ORDER.length });
      return;
    }
    if (input === "g") {
      dispatch({ type: "CYCLE_GROUP", max: GROUP_ORDER.length });
      return;
    }
    if (key.tab) {
      dispatch({
        type: "CYCLE_TAB",
        direction: key.shift ? -1 : 1,
        max: DETAIL_TABS.length,
      });
      return;
    }
    if (input === "a") {
      dispatch({
        type: "SET_SELECTED",
        indices: addVisible(state.selectedIndices, itemRows),
      });
      return;
    }
    if (input === "n") {
      dispatch({
        type: "SET_SELECTED",
        indices: removeVisible(state.selectedIndices, itemRows),
      });
      return;
    }
    if (input === "s") {
      dispatch({
        type: "SET_SELECTED",
        indices: selectSafe(state.selectedIndices, itemRows, items),
      });
      return;
    }
    if (input === "b") {
      dispatch({
        type: "SET_SELECTED",
        indices: clearBlocked(state.selectedIndices, itemRows, items),
      });
      return;
    }
    if (input === "x") {
      dispatch({
        type: "SET_SELECTED",
        indices: selectActionable(state.selectedIndices, itemRows, items),
      });
      return;
    }
    if (input === " ") {
      dispatch({ type: "TOGGLE_SELECTED", index: focusedIndex });
      return;
    }
    if (input === "q" || (key.escape && !state.showHelp)) {
      onComplete(selectedItems);
      return;
    }
    if (key.return) {
      onComplete(selectedItems);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <DashboardHeader
        title={title}
        subtitle={subtitle}
        platformLabel={platformLabel}
        metrics={visibleMetrics}
      />

      <Box marginTop={1} flexDirection="row">
        <FilterRail
          width={layout.railWidth}
          filterIndex={state.filterIndex}
          search={state.search}
          searchMode={state.searchMode}
          activeSort={activeSort}
          activeGroup={activeGroup}
          activeTab={activeTab}
        />

        <QueuePanel
          width={layout.queueWidth}
          items={items}
          visibleRows={visibleRows}
          itemRows={itemRows}
          renderWindow={renderWindow}
          rowPositionByIndex={rowPositionByIndex}
          boundedCursor={boundedCursor}
          selectedIndices={state.selectedIndices}
        />

        <DecisionPanel
          width={layout.detailWidth}
          activeTab={activeTab}
          focusedItem={focusedItem}
        />
      </Box>

      <ActionBar />
      {state.showHelp ? <HelpPanel /> : null}
    </Box>
  );
}

function DashboardHeader({
  title,
  subtitle,
  platformLabel,
  metrics,
}: {
  title?: string;
  subtitle?: string;
  platformLabel: string;
  metrics: DashboardMetrics;
}) {
  return (
    <>
      <Text bold color="cyan">
        {title ?? "Rainy Dashboard"}
      </Text>
      <Text color="gray">
        {subtitle ??
          "Check detects, doctor summarizes, dashboard decides, upgrade applies."}
      </Text>
      <Text color="gray">
        {platformLabel} keys: arrows or hjkl, Tab changes panel, / search, ?
        help, Enter confirm
      </Text>
      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text>
          visible {metrics.total} | selected {metrics.selected} | actionable{" "}
          {metrics.actionable} | blocked {metrics.blocked} | security{" "}
          {metrics.security}
        </Text>
      </Box>
    </>
  );
}

function FilterRail({
  width,
  filterIndex,
  search,
  searchMode,
  activeSort,
  activeGroup,
  activeTab,
}: {
  width: number;
  filterIndex: number;
  search: string;
  searchMode: boolean;
  activeSort: SortKey;
  activeGroup: GroupKey;
  activeTab: DashboardDetailTab;
}) {
  return (
    <Box
      width={width}
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
  );
}

function QueuePanel({
  width,
  items,
  visibleRows,
  itemRows,
  renderWindow,
  rowPositionByIndex,
  boundedCursor,
  selectedIndices,
}: {
  width: number;
  items: ReviewItem[];
  visibleRows: VisibleRow[];
  itemRows: Array<VisibleRow & { index: number }>;
  renderWindow: RenderWindow;
  rowPositionByIndex: Map<number, number>;
  boundedCursor: number;
  selectedIndices: Set<number>;
}) {
  return (
    <Box
      marginLeft={1}
      width={width}
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      <Text bold>
        Review Queue
        {renderWindow.start > 0 ? "  [more above]" : ""}
        {renderWindow.end < visibleRows.length ? "  [more below]" : ""}
      </Text>
      {itemRows.length === 0 ? (
        <Text color="gray">No review candidates match this view.</Text>
      ) : (
        renderWindow.rows.map((row) => (
          <QueueRow
            key={row.kind === "group" ? `group:${row.label}` : `${items[row.index ?? 0]?.update.packagePath}:${items[row.index ?? 0]?.update.name}`}
            row={row}
            items={items}
            rowPositionByIndex={rowPositionByIndex}
            boundedCursor={boundedCursor}
            selectedIndices={selectedIndices}
          />
        ))
      )}
    </Box>
  );
}

function QueueRow({
  row,
  items,
  rowPositionByIndex,
  boundedCursor,
  selectedIndices,
}: {
  row: VisibleRow;
  items: ReviewItem[];
  rowPositionByIndex: Map<number, number>;
  boundedCursor: number;
  selectedIndices: Set<number>;
}) {
  if (row.kind === "group") {
    return (
      <Text bold color="gray">
        {row.label}
      </Text>
    );
  }

  const index = row.index ?? 0;
  const item = items[index];
  const update = item.update;
  const decision = update.decisionState ?? deriveDecision(item);
  const itemPosition = rowPositionByIndex.get(index) ?? -1;
  const isFocused = itemPosition === boundedCursor;
  const isSelected = selectedIndices.has(index);

  return (
    <Box flexDirection="row">
      <Text color={isFocused ? "cyan" : "gray"}>
        {isFocused ? ">" : " "} {isSelected ? "[x]" : "[ ]"}{" "}
      </Text>
      <Box width={24}>
        <Text bold={isFocused}>{truncate(update.name, 22)}</Text>
      </Box>
      <Box width={10}>
        <Text color={diffColor(update.diffType)}>{update.diffType}</Text>
      </Box>
      <Box width={11}>
        <Text color={riskColor(update.riskLevel)}>
          {update.riskLevel ?? "low"}
        </Text>
      </Box>
      <Box width={12}>
        <Text color={decisionColor(decision)}>{truncate(decision, 10)}</Text>
      </Box>
      <Box width={7}>
        <Text color={decisionColor(decision)}>{update.riskScore ?? "--"}</Text>
      </Box>
      <Text color="gray">
        {truncate(update.fromRange, 12)} {"->"}{" "}
      </Text>
      <Text color="green">{truncate(update.toVersionResolved, 12)}</Text>
    </Box>
  );
}

function DecisionPanel({
  width,
  activeTab,
  focusedItem,
}: {
  width: number;
  activeTab: DashboardDetailTab;
  focusedItem?: ReviewItem;
}) {
  return (
    <Box
      marginLeft={1}
      width={width}
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
  );
}

function ActionBar() {
  return (
    <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="gray">
        A add visible | N clear visible | S safe | X actionable | B clear blocked
        | Space toggle | Q finish
      </Text>
    </Box>
  );
}

function HelpPanel() {
  return (
    <Box
      marginTop={1}
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      flexDirection="column"
    >
      <Text bold>Help</Text>
      <Text color="gray">
        Use filters for queue slices, search with /, and switch panels with Tab.
      </Text>
      <Text color="gray">
        The queue is windowed around the focused package for faster rendering in
        large workspaces.
      </Text>
      <Text color="gray">
        Actionable items can be bulk-selected with X. Blocked items stay easy to
        clear with B.
      </Text>
    </Box>
  );
}

function renderTab(
  item: ReviewItem,
  tab: DashboardDetailTab,
): React.JSX.Element {
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
          recommended:{" "}
          {truncate(
            update.recommendedAction ?? "Safe to keep in the selected set.",
            80,
          )}
        </Text>
        {update.riskReasons && update.riskReasons.length > 0 ? (
          update.riskReasons.slice(0, 5).map((reason) => (
            <Text key={reason} color="gray">
              - {truncate(reason, 48)}
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
              - {truncate(
                `${advisory.severity} ${advisory.cveId}: ${advisory.title}`,
                48,
              )}
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
              - {truncate(
                `${conflict.requester} requires ${conflict.peer} ${conflict.requiredRange}`,
                48,
              )}
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
        <Text>repository: {truncate(update.repository ?? "unavailable", 48)}</Text>
        <Text>homepage: {truncate(update.homepage ?? "unavailable", 48)}</Text>
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
        <Text>{truncate(update.releaseNotesSummary?.title ?? "Release notes unavailable", 48)}</Text>
        <Text color="gray">
          {truncate(
            update.releaseNotesSummary?.excerpt ??
              "Run review with changelog support or inspect the repository manually.",
            96,
          )}
        </Text>
      </>
    );
  }
  return (
    <>
      <Text>{update.name}</Text>
      <Text color="gray">package: {truncate(update.packagePath, 48)}</Text>
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
        {truncate(
          update.recommendedAction ?? "Safe to keep in the selected set.",
          80,
        )}
      </Text>
    </>
  );
}

function buildVisibleRows(
  items: ReviewItem[],
  config: {
    filter: DashboardFilterKey;
    sort: SortKey;
    group: GroupKey;
    search: string;
  },
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

function matchesFilter(item: ReviewItem, filter: DashboardFilterKey): boolean {
  if (filter === "security") return item.advisories.length > 0;
  if (filter === "risky") {
    return item.update.riskLevel === "critical" || item.update.riskLevel === "high";
  }
  if (filter === "major") return item.update.diffType === "major";
  if (filter === "peer-conflict") return item.peerConflicts.length > 0;
  if (filter === "license") return item.update.licenseStatus === "denied";
  if (filter === "unused") return item.unusedIssues.length > 0;
  if (filter === "blocked") {
    return (item.update.decisionState ?? deriveDecision(item)) === "blocked";
  }
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
    const byAdvisories = right.advisories.length - left.advisories.length;
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
  if (group === "decision") {
    return item.update.decisionState ?? deriveDecision(item);
  }
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

function selectActionable(
  selected: Set<number>,
  rows: Array<VisibleRow & { index: number }>,
  items: ReviewItem[],
): Set<number> {
  const next = new Set(selected);
  for (const row of rows) {
    const decision = items[row.index]?.update.decisionState ??
      deriveDecision(items[row.index]!);
    if (decision === "actionable" || decision === "review") {
      next.add(row.index);
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
  if ((item.update.advisoryCount ?? 0) > 0 || item.update.riskLevel === "critical") {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createDashboardLayout(stdoutWidth: number): DashboardLayout {
  const railWidth = clamp(Math.floor(stdoutWidth * 0.2), 24, 30);
  const detailWidth = clamp(Math.floor(stdoutWidth * 0.26), 36, 54);
  const queueWidth = Math.max(48, stdoutWidth - railWidth - detailWidth - 8);
  return { railWidth, detailWidth, queueWidth };
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return value.slice(0, maxLength);
  return `${value.slice(0, Math.max(1, maxLength - 1))}…`;
}

function createRowPositionMap(
  rows: Array<VisibleRow & { index: number }>,
): Map<number, number> {
  const map = new Map<number, number>();
  rows.forEach((row, position) => {
    map.set(row.index, position);
  });
  return map;
}

function createRenderWindow(config: {
  visibleRows: VisibleRow[];
  focusedIndex: number;
  stdoutHeight: number;
}): RenderWindow {
  const maxRows = clamp(config.stdoutHeight - 16, 8, 18);
  if (config.visibleRows.length <= maxRows) {
    return {
      rows: config.visibleRows,
      start: 0,
      end: config.visibleRows.length,
    };
  }

  const focusedRow = Math.max(
    0,
    config.visibleRows.findIndex(
      (row) => row.kind === "item" && row.index === config.focusedIndex,
    ),
  );
  let start = Math.max(0, focusedRow - Math.floor(maxRows / 2));
  let end = Math.min(config.visibleRows.length, start + maxRows);
  start = Math.max(0, end - maxRows);

  return {
    rows: config.visibleRows.slice(start, end),
    start,
    end,
  };
}

function summarizeVisibleItems(
  rows: Array<VisibleRow & { index: number }>,
  items: ReviewItem[],
  selected: Set<number>,
): DashboardMetrics {
  let actionable = 0;
  let blocked = 0;
  let security = 0;
  let selectedCount = 0;

  for (const row of rows) {
    const item = items[row.index];
    const decision = item.update.decisionState ?? deriveDecision(item);
    if (selected.has(row.index)) selectedCount += 1;
    if (decision === "actionable" || decision === "review") actionable += 1;
    if (decision === "blocked") blocked += 1;
    if (item.advisories.length > 0) security += 1;
  }

  return {
    total: rows.length,
    selected: selectedCount,
    actionable,
    blocked,
    security,
  };
}

export async function runTui(
  items: ReviewItem[],
  options?: {
    title?: string;
    subtitle?: string;
    initialFilter?: DashboardFilterKey;
    initialTab?: DashboardDetailTab;
  },
): Promise<ReviewItem[]> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <TuiApp
        items={items}
        title={options?.title}
        subtitle={options?.subtitle}
        initialFilter={options?.initialFilter}
        initialTab={options?.initialTab}
        onComplete={(selected) => {
          unmount();
          resolve(selected);
        }}
      />,
    );
  });
}
