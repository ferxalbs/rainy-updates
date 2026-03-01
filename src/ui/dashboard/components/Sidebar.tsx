import React from "react";
import { Box, Text } from "ink";
import { useDashboardStore } from "../store.js";
import type { PackageUpdate } from "../../../types/index.js";

// A heavily memoized single row
const DependencyRow = React.memo<{
  update: PackageUpdate;
  index: number;
  isActive: boolean;
}>(({ update, isActive }) => {
  return (
    <Box paddingX={1} width="100%">
      <Box width={2}>
        <Text color="cyan">{isActive ? "> " : "  "}</Text>
      </Box>
      <Box flexGrow={1}>
        <Text color={isActive ? "white" : "gray"} bold={isActive}>
          {update.name}
        </Text>
      </Box>
      <Box width={15} justifyContent="flex-end">
        <Text dimColor>{update.fromRange}</Text>
      </Box>
      <Box width={3} justifyContent="center">
        <Text dimColor>→</Text>
      </Box>
      <Box width={15}>
        <Text color="green">{update.toRange}</Text>
      </Box>
    </Box>
  );
});

DependencyRow.displayName = "DependencyRow";

function SidebarComponent() {
  const updates = useDashboardStore((s) => s.updates);
  const selectedIndex = useDashboardStore((s) => s.selectedIndex);

  // Simple windowing: in a real robust TUI we'd calculate terminal height
  // For now we'll just slice the array based on a fixed viewport (e.g., 20 items)
  const windowSize = 20;
  const start = Math.max(
    0,
    Math.min(selectedIndex - windowSize / 2, updates.length - windowSize),
  );
  const visibleUpdates = updates.slice(start, start + windowSize);

  return (
    <Box
      width="50%"
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      height={windowSize + 2} // fixed height to prevent terminal jitter
    >
      {visibleUpdates.map((update, i) => {
        const actualIndex = start + i;
        return (
          <DependencyRow
            key={`${update.name}-${update.toRange}`}
            update={update}
            index={actualIndex}
            isActive={actualIndex === selectedIndex}
          />
        );
      })}
      {updates.length === 0 && (
        <Box paddingX={1}>
          <Text dimColor>No updates found.</Text>
        </Box>
      )}
    </Box>
  );
}

export const Sidebar = React.memo(SidebarComponent);
