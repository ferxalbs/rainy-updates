import { expect, test } from "bun:test";
import {
  deriveDashboardInitialFilter,
  deriveDashboardInitialTab,
} from "../src/ui/dashboard-state.js";

test("dashboard security focus opens the security queue and panel", () => {
  expect(
    deriveDashboardInitialFilter({ focus: "security", view: undefined }),
  ).toBe("security");
  expect(
    deriveDashboardInitialTab({ focus: "security", view: undefined }),
  ).toBe("security");
});

test("dashboard health view opens risky filter with health panel", () => {
  expect(
    deriveDashboardInitialFilter({ focus: "all", view: "health" }),
  ).toBe("risky");
  expect(
    deriveDashboardInitialTab({ focus: "all", view: "health" }),
  ).toBe("health");
});

