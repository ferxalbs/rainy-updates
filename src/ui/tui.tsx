import React, { useState } from "react";
import { Box, render, Text, useInput } from "ink";
import type { PackageUpdate, RiskLevel, TargetLevel } from "../types/index.js";

const FILTER_ORDER: Array<"all" | "security" | "risky" | "major"> = [
  "all",
  "security",
  "risky",
  "major",
];

function VersionDiff({ from, to }: { from: string; to: string }) {
  return (
    <Box>
      <Text color="gray">{from}</Text>
      <Text color="gray"> {" -> "} </Text>
      <Text color="green">{to}</Text>
    </Box>
  );
}

function riskColor(level: RiskLevel | undefined): string {
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

function diffColor(level: TargetLevel): string {
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

function decisionLabel(update: PackageUpdate): string {
  if (update.peerConflictSeverity === "error" || update.licenseStatus === "denied") {
    return "blocked";
  }
  if (update.advisoryCount && update.advisoryCount > 0) {
    return "actionable";
  }
  if (update.riskLevel === "critical" || update.riskLevel === "high") {
    return "review";
  }
  return "safe";
}

function decisionColor(label: string): string {
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

interface TuiAppProps {
  updates: PackageUpdate[];
  onComplete: (selected: PackageUpdate[]) => void;
}

function TuiApp({ updates, onComplete }: TuiAppProps) {
  const [cursorIndex, setCursorIndex] = useState(0);
  const [filterIndex, setFilterIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(updates.map((_, index) => index)),
  );

  const activeFilter = FILTER_ORDER[filterIndex] ?? "all";
  const filteredIndices = updates
    .map((update, index) => ({ update, index }))
    .filter(({ update }) => {
      if (activeFilter === "security") return (update.advisoryCount ?? 0) > 0;
      if (activeFilter === "risky") {
        return update.riskLevel === "critical" || update.riskLevel === "high";
      }
      if (activeFilter === "major") return update.diffType === "major";
      return true;
    })
    .map(({ index }) => index);

  const boundedCursor = Math.min(
    cursorIndex,
    Math.max(0, filteredIndices.length - 1),
  );
  const focusedIndex = filteredIndices[boundedCursor] ?? 0;
  const focusedUpdate = updates[focusedIndex];

  useInput((input, key) => {
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
      setCursorIndex((prev) =>
        Math.min(filteredIndices.length - 1, Math.max(0, prev + 1)),
      );
    }
    if (input === "a") {
      setSelectedIndices(new Set(filteredIndices));
    }
    if (input === "n") {
      setSelectedIndices(new Set());
    }
    if (input === " ") {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(focusedIndex)) next.delete(focusedIndex);
        else next.add(focusedIndex);
        return next;
      });
    }
    if (key.return) {
      onComplete(updates.filter((_, index) => selectedIndices.has(index)));
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
        Left/Right filter  Up/Down move  Space toggle  A select visible  N clear  Enter confirm
      </Text>

      <Box marginTop={1}>
        {FILTER_ORDER.map((filter, index) => (
          <Box key={filter} marginRight={2}>
            <Text color={index === filterIndex ? "cyan" : "gray"}>
              [{filter}]
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1} flexDirection="row">
        <Box width={72} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          <Text bold>Review Queue</Text>
          {filteredIndices.length === 0 ? (
            <Text color="gray">No review candidates match this filter.</Text>
          ) : (
            filteredIndices.map((index, visibleIndex) => {
              const update = updates[index];
              const isFocused = visibleIndex === boundedCursor;
              const isSelected = selectedIndices.has(index);
              const decision = decisionLabel(update);
              return (
                <Box key={`${update.packagePath}:${update.name}`} flexDirection="row">
                  <Text color={isFocused ? "cyan" : "gray"}>
                    {isFocused ? ">" : " "} {isSelected ? "[x]" : "[ ]"}{" "}
                  </Text>
                  <Box width={22}>
                    <Text bold={isFocused}>{update.name}</Text>
                  </Box>
                  <Box width={10}>
                    <Text color={diffColor(update.diffType)}>{update.diffType}</Text>
                  </Box>
                  <Box width={18}>
                    <Text color={riskColor(update.riskLevel)}>
                      {update.riskLevel ?? update.impactScore?.rank ?? "low"}
                    </Text>
                  </Box>
                  <Box width={12}>
                    <Text color={decisionColor(decision)}>{decision}</Text>
                  </Box>
                  <Box width={10}>
                    <Text color={decisionColor(decision)}>
                      {typeof update.riskScore === "number" ? update.riskScore : "--"}
                    </Text>
                  </Box>
                  <VersionDiff from={update.fromRange} to={update.toVersionResolved} />
                </Box>
              );
            })
          )}
        </Box>

        <Box
          marginLeft={1}
          width={46}
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
        >
          <Text bold>Decision Panel</Text>
          {focusedUpdate ? (
            <>
              <Text>{focusedUpdate.name}</Text>
              <Text color="gray">package: {focusedUpdate.packagePath}</Text>
              <Text>
                state:{" "}
                <Text color={decisionColor(decisionLabel(focusedUpdate))}>
                  {decisionLabel(focusedUpdate)}
                </Text>
              </Text>
              <Text>
                diff: <Text color={diffColor(focusedUpdate.diffType)}>{focusedUpdate.diffType}</Text>
              </Text>
              <Text>
                risk: <Text color={riskColor(focusedUpdate.riskLevel)}>{focusedUpdate.riskLevel ?? focusedUpdate.impactScore?.rank ?? "low"}</Text>
              </Text>
              <Text>risk score: {focusedUpdate.riskScore ?? 0}</Text>
              <Text>impact score: {focusedUpdate.impactScore?.score ?? 0}</Text>
              <Text>advisories: {focusedUpdate.advisoryCount ?? 0}</Text>
              <Text>peer: {focusedUpdate.peerConflictSeverity ?? "none"}</Text>
              <Text>license: {focusedUpdate.licenseStatus ?? "allowed"}</Text>
              <Text>health: {focusedUpdate.healthStatus ?? "healthy"}</Text>
              <Text>
                action:{" "}
                <Text color={decisionColor(decisionLabel(focusedUpdate))}>
                  {focusedUpdate.recommendedAction ?? "Safe to keep in the review queue."}
                </Text>
              </Text>
              {focusedUpdate.homepage ? (
                <Text color="blue">homepage: {focusedUpdate.homepage}</Text>
              ) : (
                <Text color="gray">homepage: unavailable</Text>
              )}
              {focusedUpdate.riskReasons && focusedUpdate.riskReasons.length > 0 ? (
                <>
                  <Text bold>Reasons</Text>
                  {focusedUpdate.riskReasons.slice(0, 4).map((reason) => (
                    <Text key={reason} color="gray">
                      - {reason}
                    </Text>
                  ))}
                </>
              ) : (
                <Text color="gray">No elevated risk reasons.</Text>
              )}
            </>
          ) : (
            <Text color="gray">No review candidate selected.</Text>
          )}
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">
          {selectedIndices.size} selected for apply of {updates.length}. Filter: {activeFilter}. Enter confirms the review decision set.
        </Text>
      </Box>
    </Box>
  );
}

export async function runTui(updates: PackageUpdate[]): Promise<PackageUpdate[]> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <TuiApp
        updates={updates}
        onComplete={(selected) => {
          unmount();
          resolve(selected);
        }}
      />,
    );
  });
}
