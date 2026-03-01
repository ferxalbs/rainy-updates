import React from "react";
import { Box, useInput, useApp } from "ink";
import type { DashboardOptions, CheckResult } from "../../types/index.js";
import { initStore, dashboardActions } from "./store.js";

import { Header } from "./components/Header.js";
import { Sidebar } from "./components/Sidebar.js";
import { DetailPanel } from "./components/DetailPanel.js";
import { Footer } from "./components/Footer.js";

export interface DashboardTUIProps {
  options: DashboardOptions;
  initialResult: CheckResult;
}

export function DashboardTUI({ options, initialResult }: DashboardTUIProps) {
  const { exit } = useApp();

  // Initialize the singleton store synchronously before rendering children
  // so that components can access it on the first render pass natively.
  initStore(options, initialResult);

  // Handle global keyboard input (doesn't trigger React re-renders unless store state affects this component)
  // Our static layout theoretically will not re-render off this hook alone.
  useInput((input, key) => {
    if (key.upArrow) {
      dashboardActions.moveCursorUp();
    }
    if (key.downArrow) {
      dashboardActions.moveCursorDown();
    }
    if (key.return) {
      dashboardActions.setShouldApply(true);
      exit();
    }
    if (input === "r") {
      void dashboardActions.runResolveAction();
    }
    if (input === "a") {
      void dashboardActions.runAuditAction();
    }
  });

  return (
    <Box flexDirection="column" minHeight={25}>
      <Header />
      <Box flexDirection="row" width="100%">
        <Sidebar />
        <DetailPanel />
      </Box>
      <Footer />
    </Box>
  );
}
