import React from "react";
import { Box, Text } from "ink";
import { useDashboardStore } from "../store.js";

function HeaderComponent() {
  const scanned = useDashboardStore((s) => s.summary.scannedPackages);
  const totalUpdates = useDashboardStore((s) => s.updates.length);
  const view = useDashboardStore((s) => s.view);

  return (
    <Box
      width="100%"
      paddingX={1}
      borderStyle="single"
      borderColor="blue"
      flexDirection="row"
      justifyContent="space-between"
    >
      <Box>
        <Text color="cyan" bold>
          🌧️ Rainy Updates Dashboard
        </Text>
      </Box>
      <Box>
        <Text>
          <Text color={view === "dependencies" ? "green" : "gray"}>
            [Dependencies]
          </Text>{" "}
          <Text color={view === "security" ? "green" : "gray"}>[Security]</Text>{" "}
          <Text color={view === "health" ? "green" : "gray"}>[Health]</Text>
        </Text>
      </Box>
      <Box>
        <Text dimColor>
          Packages: {scanned} | Found: {totalUpdates}
        </Text>
      </Box>
    </Box>
  );
}

// Memoize to ensure Header only renders when deeply affected (which is rare)
export const Header = React.memo(HeaderComponent);
