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
  onComplete: (selected: ReviewItem[]) => void;
}

interface VisibleRow {
  kind: "group" | "item";
  label: string;
  index?: number;
}

function TuiApp({ items, onComplete }: TuiAppProps) {
  const [cursorIndex, setCursorIndex] = useState(0);
  const [filterIndex, setFilterIndex] = useState(0);
  const [sortIndex, setSortIndex] = useState(0);
  const [groupIndex, setGroupIndex] = useState(0);
  const [tabIndex, setTabIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(
      items.flatMap((item, index) =>
        item.update.selectedByDefault === false ? [] : [index],
      ),
    ),
  );

  const activeFilter = FILTER_ORDER[filterIndex] ?? "all";
  const activeSort = SORT_ORDER[sortIndex] ?? "risk";
  const activeGroup = GROUP_ORDER[groupIndex] ?? "none";
  const activeTab = DETAIL_TABS[tabIndex] ?? "overview";

  const visibleRows = buildVisibleRows(items, {
    filter: activeFilter,
    sort: activeSort,
    group: activeGroup,
    search,
  });
  const itemRows = visibleRows.filter((row): row is VisibleRow & { index: number } => row.kind === "item" && typeof row.index === "number");
  const boundedCursor = Math.min(cursorIndex, Math.max(0, itemRows.length - 1));
  const focusedIndex = itemRows[boundedCursor]?.index ?? 0;
  const focusedItem = items[focusedIndex];

  useInput((input, key) => {
    if (searchMode) {
      if (key.escape) {
        setSearchMode(false);
        setSearch("");
        setCursorIndex(0);
        return;
      }
      if (key.return) {
        setSearchMode(false);
        setCursorIndex(0);
        return;
      }
      if (key.backspace || key.delete) {
        setSearch((value) => value.slice(0, -1));
        setCursorIndex(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearch((value) => value + input);
        setCursorIndex(0);
      }
      return;
    }

    if (input === "/") {
      setSearchMode(true);
      return;
    }
    if (input === "?") {
      setShowHelp((value) => !value);
      return;
    }
    if (key.escape && showHelp) {
      setShowHelp(false);
      return;
    }
    if (key.leftArrow) {
      setFilterIndex((prev) => Math.max(0, prev - 1));
      setCursorIndex(0);
    }
    if (key.rightArrow) {
      setFilterIndex((prev) => Math.min(FILTER_ORDER.length - 1, prev + 1));
      setCursorIndex(0);
    }
    if (key.upArrow) {
      setCursorIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setCursorIndex((prev) => Math.min(itemRows.length - 1, Math.max(0, prev + 1)));
    }
    if (input === "o") {
      setSortIndex((prev) => (prev + 1) % SORT_ORDER.length);
      setCursorIndex(0);
    }
    if (input === "g") {
      setGroupIndex((prev) => (prev + 1) % GROUP_ORDER.length);
      setCursorIndex(0);
    }
    if (key.tab) {
      setTabIndex((prev) => (prev + 1) % DETAIL_TABS.length);
    }
    if (input === "a") {
      setSelectedIndices((prev) => addVisible(prev, itemRows));
    }
    if (input === "n") {
      setSelectedIndices((prev) => removeVisible(prev, itemRows));
    }
    if (input === "s") {
      setSelectedIndices((prev) => selectSafe(prev, itemRows, items));
    }
    if (input === "b") {
      setSelectedIndices((prev) => clearBlocked(prev, itemRows, items));
    }
    if (input === " ") {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(focusedIndex)) next.delete(focusedIndex);
        else next.add(focusedIndex);
        return next;
      });
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
        Rainy Review Queue
      </Text>
      <Text color="gray">
        Detect with check, summarize with doctor, decide here in review, then apply with upgrade.
      </Text>
      <Text color="gray">
        Filters: ←/→  Sort: o  Group: g  Tabs: Tab  Search: /  Help: ?  Space: toggle  Enter: confirm
      </Text>

      <Box marginTop={1} flexDirection="row">
        <Box width={24} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          <Text bold>Filter Rail</Text>
          {FILTER_ORDER.map((filter, index) => (
            <Text key={filter} color={index === filterIndex ? "cyan" : "gray"}>
              {index === filterIndex ? ">" : " "} {filter}
            </Text>
          ))}
          <Box marginTop={1} flexDirection="column">
            <Text bold>Search</Text>
            <Text color={searchMode ? "cyan" : "gray"}>{searchMode ? `/${search}` : search ? `/${search}` : "inactive"}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text bold>Modes</Text>
            <Text color="gray">sort: {activeSort}</Text>
            <Text color="gray">group: {activeGroup}</Text>
            <Text color="gray">tab: {activeTab}</Text>
          </Box>
        </Box>

        <Box marginLeft={1} width={82} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
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
              const itemPosition = itemRows.findIndex((candidate) => candidate.index === index);
              const isFocused = itemPosition === boundedCursor;
              const isSelected = selectedIndices.has(index);
              return (
                <Box key={`${update.packagePath}:${update.name}`} flexDirection="row">
                  <Text color={isFocused ? "cyan" : "gray"}>
                    {isFocused ? ">" : " "} {isSelected ? "[x]" : "[ ]"}{" "}
                  </Text>
                  <Box width={22}>
                    <Text bold={isFocused}>{update.name}</Text>
                  </Box>
                  <Box width={14}>
                    <Text color={diffColor(update.diffType)}>{update.diffType}</Text>
                  </Box>
                  <Box width={14}>
                    <Text color={riskColor(update.riskLevel)}>{update.riskLevel ?? "low"}</Text>
                  </Box>
                  <Box width={14}>
                    <Text color={decisionColor(decision)}>{decision}</Text>
                  </Box>
                  <Box width={10}>
                    <Text color={decisionColor(decision)}>{update.riskScore ?? "--"}</Text>
                  </Box>
                  <Text color="gray">{update.fromRange}</Text>
                  <Text color="gray"> → </Text>
                  <Text color="green">{update.toVersionResolved}</Text>
                </Box>
              );
            })
          )}
        </Box>

        <Box marginLeft={1} width={54} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          <Text bold>Decision Panel</Text>
          <Text color="gray">tab: {activeTab}</Text>
          {focusedItem ? renderTab(focusedItem, activeTab) : <Text color="gray">No review candidate selected.</Text>}
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">
          {selectedIndices.size} selected of {items.length}. view={activeFilter} sort={activeSort} group={activeGroup}
        </Text>
      </Box>

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">
          A select visible  N clear visible  S select safe  B clear blocked  Q finish  Esc clears search/help
        </Text>
      </Box>

      {showHelp ? (
        <Box marginTop={1} borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
          <Text bold>Help</Text>
          <Text color="gray">Use review as the decision center. Search packages with / and inspect details with Tab.</Text>
          <Text color="gray">Blocked items default to deselected. Safe items can be bulk-selected with S.</Text>
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
        <Text>state: <Text color={decisionColor(update.decisionState ?? deriveDecision(item))}>{update.decisionState ?? deriveDecision(item)}</Text></Text>
        <Text>policy: <Text color={decisionColor(policyToDecision(update.policyAction))}>{update.policyAction ?? "allow"}</Text></Text>
        <Text>risk score: {update.riskScore ?? 0}</Text>
        <Text>impact score: {update.impactScore?.score ?? 0}</Text>
        <Text>recommended action: {update.recommendedAction ?? "Safe to keep in the selected set."}</Text>
        {update.riskReasons && update.riskReasons.length > 0 ? update.riskReasons.slice(0, 5).map((reason) => (
          <Text key={reason} color="gray">- {reason}</Text>
        )) : <Text color="gray">No elevated risk reasons.</Text>}
      </>
    );
  }
  if (tab === "security") {
    return (
      <>
        <Text>advisories: {item.advisories.length}</Text>
        {item.advisories.length > 0 ? item.advisories.slice(0, 4).map((advisory) => (
          <Text key={`${advisory.packageName}:${advisory.cveId}`} color="gray">
            - {advisory.severity} {advisory.cveId}: {advisory.title}
          </Text>
        )) : <Text color="gray">No security advisories detected.</Text>}
      </>
    );
  }
  if (tab === "peer") {
    return (
      <>
        <Text>peer status: {update.peerConflictSeverity ?? "none"}</Text>
        {item.peerConflicts.length > 0 ? item.peerConflicts.slice(0, 4).map((conflict) => (
          <Text key={`${conflict.requester}:${conflict.peer}`} color="gray">
            - {conflict.requester} requires {conflict.peer} {conflict.requiredRange}
          </Text>
        )) : <Text color="gray">No peer conflicts detected.</Text>}
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
        <Text>{update.releaseNotesSummary?.title ?? "Release notes unavailable"}</Text>
        <Text color="gray">{update.releaseNotesSummary?.excerpt ?? "Run review with changelog support or inspect the repository manually."}</Text>
      </>
    );
  }
  return (
    <>
      <Text>{update.name}</Text>
      <Text color="gray">package: {update.packagePath}</Text>
      <Text>state: <Text color={decisionColor(update.decisionState ?? deriveDecision(item))}>{update.decisionState ?? deriveDecision(item)}</Text></Text>
      <Text>diff: <Text color={diffColor(update.diffType)}>{update.diffType}</Text></Text>
      <Text>risk: <Text color={riskColor(update.riskLevel)}>{update.riskLevel ?? "low"}</Text></Text>
      <Text>policy: {update.policyAction ?? "allow"}</Text>
      <Text>workspace: {update.workspaceGroup ?? "root"}</Text>
      <Text>group: {update.groupKey ?? "none"}</Text>
      <Text>action: {update.recommendedAction ?? "Safe to keep in the selected set."}</Text>
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
    return filtered.map(({ item, index }) => ({ kind: "item", label: item.update.name, index }));
  }

  const rows: VisibleRow[] = [];
  let currentGroup = "";
  for (const entry of filtered) {
    const nextGroup = groupLabel(entry.item, config.group);
    if (nextGroup !== currentGroup) {
      currentGroup = nextGroup;
      rows.push({ kind: "group", label: nextGroup });
    }
    rows.push({ kind: "item", label: entry.item.update.name, index: entry.index });
  }
  return rows;
}

function matchesFilter(item: ReviewItem, filter: FilterKey): boolean {
  if (filter === "security") return item.advisories.length > 0;
  if (filter === "risky") return item.update.riskLevel === "critical" || item.update.riskLevel === "high";
  if (filter === "major") return item.update.diffType === "major";
  if (filter === "peer-conflict") return item.peerConflicts.length > 0;
  if (filter === "license") return item.update.licenseStatus === "denied";
  if (filter === "unused") return item.unusedIssues.length > 0;
  if (filter === "blocked") return (item.update.decisionState ?? deriveDecision(item)) === "blocked";
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

function compareItems(left: ReviewItem, right: ReviewItem, sort: SortKey): number {
  if (sort === "advisories") {
    const byAdvisories = (right.advisories.length ?? 0) - (left.advisories.length ?? 0);
    if (byAdvisories !== 0) return byAdvisories;
  }
  if (sort === "diff") {
    const byDiff = diffWeight(right.update.diffType) - diffWeight(left.update.diffType);
    if (byDiff !== 0) return byDiff;
  }
  if (sort === "workspace") {
    const byWorkspace = (left.update.workspaceGroup ?? left.update.packagePath).localeCompare(
      right.update.workspaceGroup ?? right.update.packagePath,
    );
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
  if (group === "decision") return item.update.decisionState ?? deriveDecision(item);
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
    if ((items[row.index]?.update.decisionState ?? deriveDecision(items[row.index]!)) === "safe") {
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
    if ((items[row.index]?.update.decisionState ?? deriveDecision(items[row.index]!)) === "blocked") {
      next.delete(row.index);
    }
  }
  return next;
}

function deriveDecision(item: ReviewItem): DecisionState {
  if (item.update.peerConflictSeverity === "error" || item.update.licenseStatus === "denied") {
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

function policyToDecision(value: ReviewItem["update"]["policyAction"]): DecisionState {
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

export async function runTui(items: ReviewItem[]): Promise<ReviewItem[]> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <TuiApp
        items={items}
        onComplete={(selected) => {
          unmount();
          resolve(selected);
        }}
      />,
    );
  });
}
