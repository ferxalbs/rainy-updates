import { describe, expect, it } from "bun:test";

describe("scoped standalone parsers", () => {
  it("health parser accepts git scope flags", async () => {
    const { parseHealthArgs } = await import("../src/commands/health/parser.js");
    const opts = parseHealthArgs(["--affected", "--base", "origin/main", "--head", "HEAD"]);
    expect(opts.affected).toBe(true);
    expect(opts.baseRef).toBe("origin/main");
    expect(opts.headRef).toBe("HEAD");
  });

  it("licenses parser accepts git scope flags", async () => {
    const { parseLicensesArgs } = await import("../src/commands/licenses/parser.js");
    const opts = parseLicensesArgs(["--staged", "--since", "origin/main"]);
    expect(opts.staged).toBe(true);
    expect(opts.sinceRef).toBe("origin/main");
  });

  it("snapshot parser accepts git scope flags", async () => {
    const { parseSnapshotArgs } = await import("../src/commands/snapshot/parser.js");
    const opts = parseSnapshotArgs(["save", "--affected"]);
    expect(opts.action).toBe("save");
    expect(opts.affected).toBe(true);
  });

  it("ga parser accepts git scope flags", async () => {
    const { parseGaArgs } = await import("../src/commands/ga/parser.js");
    const opts = parseGaArgs(["--staged"]);
    expect(opts.staged).toBe(true);
  });
});
