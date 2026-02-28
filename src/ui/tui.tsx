import React, { useState } from "react";
import { render, Text, Box, useInput } from "ink";
import type { PackageUpdate } from "../types/index.js";

// Basic version diff string parser to split major.minor.patch
export function VersionDiff({ from, to }: { from: string; to: string }) {
  if (from === to) return <Text color="gray">{to}</Text>;

  // Very simplistic semver coloring: highlight the changed part
  // E.g., from 1.2.3 to 1.3.0 -> 1 is dim, 3.0 is bright green
  return (
    <Box>
      <Text color="gray">{from} → </Text>
      <Text color="green">{to}</Text>
    </Box>
  );
}

interface TuiAppProps {
  updates: PackageUpdate[];
  onComplete: (selected: PackageUpdate[]) => void;
}

function TuiApp({ updates, onComplete }: TuiAppProps) {
  const [cursorIndex, setCursorIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(updates.map((_, i) => i)), // all selected by default
  );

  useInput((input, key) => {
    if (key.upArrow) {
      setCursorIndex((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setCursorIndex((prev) => Math.min(updates.length - 1, prev + 1));
    }
    if (input === " ") {
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(cursorIndex)) next.delete(cursorIndex);
        else next.add(cursorIndex);
        return next;
      });
    }
    if (key.return) {
      const selected = updates.filter((_, i) => selectedIndices.has(i));
      onComplete(selected);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Choose updates to install (Space to toggle, Enter to confirm, Up/Down to
        navigate)
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {updates.map((update, index) => {
          const isSelected = selectedIndices.has(index);
          const isFocused = cursorIndex === index;

          return (
            <Box key={update.name} flexDirection="row">
              <Text color={isFocused ? "cyan" : "gray"}>
                {isFocused ? "❯ " : "  "}
                {isSelected ? "◉ " : "◯ "}
              </Text>

              <Box width={30}>
                <Text bold={isFocused}>{update.name}</Text>
              </Box>

              <Box width={15}>
                <Text color="gray">{update.diffType}</Text>
              </Box>

              <VersionDiff
                from={update.fromRange}
                to={update.toVersionResolved}
              />
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">
          {selectedIndices.size} of {updates.length} selected
        </Text>
      </Box>
    </Box>
  );
}

export async function runTui(
  updates: PackageUpdate[],
): Promise<PackageUpdate[]> {
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
