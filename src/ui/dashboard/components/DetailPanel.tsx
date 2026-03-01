import React from "react";
import { Box, Text } from "ink";
import { useDashboardStore } from "../store.js";
import type { RiskLevel } from "../../../types/index.js";

function getRiskColor(risk?: RiskLevel) {
  switch (risk) {
    case "critical":
      return "red";
    case "high":
      return "red";
    case "medium":
      return "yellow";
    case "low":
      return "blue";
    default:
      return "gray";
  }
}

function DetailPanelComponent() {
  const selectedIndex = useDashboardStore((s) => s.selectedIndex);
  const updates = useDashboardStore((s) => s.updates);

  // Fallback if list is empty
  const update = updates[selectedIndex];

  if (!update) {
    return (
      <Box
        width="50%"
        height={22}
        padding={1}
        borderStyle="single"
        borderColor="gray"
      >
        <Text dimColor>No package selected.</Text>
      </Box>
    );
  }

  const {
    name,
    publishedAt,
    publishAgeDays,
    riskLevel,
    homepage,
    advisoryCount,
    peerConflictSeverity,
  } = update;

  return (
    <Box
      width="50%"
      height={22}
      flexDirection="column"
      paddingX={2}
      borderStyle="single"
      borderColor="gray"
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {name}
        </Text>
      </Box>
      <Box marginBottom={2} flexDirection="column">
        <Text>
          <Text bold>Risk: </Text>
          <Text color={getRiskColor(riskLevel)}>{riskLevel || "unknown"}</Text>
        </Text>
        <Text>
          <Text bold>Advisories: </Text>
          <Text color={advisoryCount ? "red" : "green"}>
            {advisoryCount || 0}
          </Text>
        </Text>
        <Text>
          <Text bold>Peer Conflicts: </Text>
          <Text color={peerConflictSeverity ? "red" : "green"}>
            {peerConflictSeverity || "none"}
          </Text>
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text color="gray">{homepage || "No homepage provided"}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Published {publishAgeDays} days ago{" "}
          {publishedAt ? `(${publishedAt})` : ""}
        </Text>
      </Box>
    </Box>
  );
}

export const DetailPanel = React.memo(DetailPanelComponent);
