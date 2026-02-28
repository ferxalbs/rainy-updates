import { describe, it, expect } from "bun:test";

describe("health parser", () => {
  it("returns defaults with no args", async () => {
    const { parseHealthArgs } =
      await import("../src/commands/health/parser.js");
    const opts = parseHealthArgs([]);
    expect(opts.staleDays).toBe(365);
    expect(opts.includeDeprecated).toBe(true);
    expect(opts.reportFormat).toBe("table");
    expect(opts.workspace).toBe(false);
  });

  it("parses --stale with days (365d)", async () => {
    const { parseHealthArgs } =
      await import("../src/commands/health/parser.js");
    const opts = parseHealthArgs(["--stale", "365d"]);
    expect(opts.staleDays).toBe(365);
  });

  it("parses --stale with months (12m)", async () => {
    const { parseHealthArgs } =
      await import("../src/commands/health/parser.js");
    const opts = parseHealthArgs(["--stale", "12m"]);
    expect(opts.staleDays).toBe(360);
  });

  it("parses --stale with plain number", async () => {
    const { parseHealthArgs } =
      await import("../src/commands/health/parser.js");
    const opts = parseHealthArgs(["--stale", "180"]);
    expect(opts.staleDays).toBe(180);
  });

  it("rejects invalid --stale", async () => {
    const { parseHealthArgs } =
      await import("../src/commands/health/parser.js");
    expect(() => parseHealthArgs(["--stale", "abc"])).toThrow(
      "--stale must be",
    );
  });

  it("parses --workspace and --alternatives", async () => {
    const { parseHealthArgs } =
      await import("../src/commands/health/parser.js");
    const opts = parseHealthArgs(["--workspace", "--alternatives"]);
    expect(opts.workspace).toBe(true);
    expect(opts.includeAlternatives).toBe(true);
  });

  it("disables deprecated with --no-deprecated", async () => {
    const { parseHealthArgs } =
      await import("../src/commands/health/parser.js");
    const opts = parseHealthArgs(["--no-deprecated"]);
    expect(opts.includeDeprecated).toBe(false);
  });

  it("parses --report json", async () => {
    const { parseHealthArgs } =
      await import("../src/commands/health/parser.js");
    const opts = parseHealthArgs(["--report", "json"]);
    expect(opts.reportFormat).toBe("json");
  });

  it("throws on unknown option", async () => {
    const { parseHealthArgs } =
      await import("../src/commands/health/parser.js");
    expect(() => parseHealthArgs(["--bar"])).toThrow(
      "Unknown health option: --bar",
    );
  });
});
