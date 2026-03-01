import React from "react";
import { Box, Text } from "ink";
import { useDashboardStore } from "../store.js";

function FooterComponent() {
  const modal = useDashboardStore((s) => s.modal);

  return (
    <Box
      width="100%"
      paddingX={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      <Box>
        <Text dimColor>
          <Text bold color="white">
            ↑↓
          </Text>{" "}
          Navigate |
          <Text bold color="white">
            {" "}
            Enter
          </Text>{" "}
          Apply |
          <Text bold color="white">
            {" "}
            r
          </Text>
          esolve |
          <Text bold color="white">
            {" "}
            a
          </Text>
          udit |
          <Text bold color="white">
            {" "}
            i
          </Text>
          gnore
        </Text>
      </Box>
      <Box>
        <Text color="yellow">
          {modal !== "none" ? `Status: ${modal}...` : "Status: Idle"}
        </Text>
      </Box>
    </Box>
  );
}

export const Footer = React.memo(FooterComponent);
