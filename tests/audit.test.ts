import { describe, it, expect } from "bun:test";

describe("audit parser", () => {
  it("returns defaults with no args", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    const opts = parseAuditArgs([]);
    expect(opts.fix).toBe(false);
    expect(opts.dryRun).toBe(false);
    expect(opts.reportFormat).toBe("table");
    expect(opts.severity).toBeUndefined();
    expect(opts.workspace).toBe(false);
  });

  it("parses --severity high", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    const opts = parseAuditArgs(["--severity", "high"]);
    expect(opts.severity).toBe("high");
  });

  it("rejects invalid severity", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    expect(() => parseAuditArgs(["--severity", "extreme"])).toThrow(
      "--severity must be",
    );
  });

  it("parses --fix and --dry-run", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    const opts = parseAuditArgs(["--fix", "--dry-run"]);
    expect(opts.fix).toBe(true);
    expect(opts.dryRun).toBe(true);
  });

  it("parses --report json", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    const opts = parseAuditArgs(["--report", "json"]);
    expect(opts.reportFormat).toBe("json");
  });

  it("parses --workspace", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    const opts = parseAuditArgs(["--workspace"]);
    expect(opts.workspace).toBe(true);
  });

  it("throws on unknown option", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    expect(() => parseAuditArgs(["--foo"])).toThrow(
      "Unknown audit option: --foo",
    );
  });
});

describe("audit mapper", () => {
  it("filters by minimum severity", async () => {
    const { filterBySeverity } =
      await import("../src/commands/audit/mapper.js");
    const advisories = [
      {
        cveId: "CVE-1",
        packageName: "a",
        severity: "critical" as const,
        vulnerableRange: "*",
        patchedVersion: "1.0.1",
        title: "t",
        url: "",
      },
      {
        cveId: "CVE-2",
        packageName: "b",
        severity: "low" as const,
        vulnerableRange: "*",
        patchedVersion: null,
        title: "t",
        url: "",
      },
      {
        cveId: "CVE-3",
        packageName: "c",
        severity: "high" as const,
        vulnerableRange: "*",
        patchedVersion: "2.0.0",
        title: "t",
        url: "",
      },
    ];
    const result = filterBySeverity(advisories, "high");
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.cveId)).toContain("CVE-1");
    expect(result.map((a) => a.cveId)).toContain("CVE-3");
  });

  it("buildPatchMap picks highest patched version per package", async () => {
    const { buildPatchMap } = await import("../src/commands/audit/mapper.js");
    const advisories = [
      {
        cveId: "CVE-1",
        packageName: "axios",
        severity: "high" as const,
        vulnerableRange: "*",
        patchedVersion: "0.21.1",
        title: "t",
        url: "",
      },
      {
        cveId: "CVE-2",
        packageName: "axios",
        severity: "medium" as const,
        vulnerableRange: "*",
        patchedVersion: "0.21.3",
        title: "t",
        url: "",
      },
    ];
    const map = buildPatchMap(advisories);
    expect(map.get("axios")).toBe("0.21.3");
  });

  it("filterBySeverity returns all when no minSeverity", async () => {
    const { filterBySeverity } =
      await import("../src/commands/audit/mapper.js");
    const advisories = [
      {
        cveId: "CVE-1",
        packageName: "a",
        severity: "low" as const,
        vulnerableRange: "*",
        patchedVersion: null,
        title: "t",
        url: "",
      },
    ];
    const result = filterBySeverity(advisories, undefined);
    expect(result).toHaveLength(1);
  });
});
