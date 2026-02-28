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
        currentVersion: "1.0.0",
        severity: "critical" as const,
        vulnerableRange: "*",
        patchedVersion: "1.0.1",
        title: "t",
        url: "",
      },
      {
        cveId: "CVE-2",
        packageName: "b",
        currentVersion: "1.0.0",
        severity: "low" as const,
        vulnerableRange: "*",
        patchedVersion: null,
        title: "t",
        url: "",
      },
      {
        cveId: "CVE-3",
        packageName: "c",
        currentVersion: "1.0.0",
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
        currentVersion: "0.21.0",
        severity: "high" as const,
        vulnerableRange: "*",
        patchedVersion: "0.21.1",
        title: "t",
        url: "",
      },
      {
        cveId: "CVE-2",
        packageName: "axios",
        currentVersion: "0.21.0",
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

  it("buildPatchMap prefers the lowest candidate that clears all ranges", async () => {
    const { buildPatchMap } = await import("../src/commands/audit/mapper.js");
    const advisories = [
      {
        cveId: "CVE-1",
        packageName: "minimist",
        currentVersion: "0.0.8",
        severity: "critical" as const,
        vulnerableRange: ">=0 <0.2.4",
        patchedVersion: "0.2.4",
        title: "t",
        url: "",
      },
      {
        cveId: "CVE-2",
        packageName: "minimist",
        currentVersion: "0.0.8",
        severity: "medium" as const,
        vulnerableRange: ">=1.0.0 <1.2.3",
        patchedVersion: "1.2.3",
        title: "t",
        url: "",
      },
    ];

    const map = buildPatchMap(advisories);
    expect(map.get("minimist")).toBe("0.2.4");
  });

  it("filterBySeverity returns all when no minSeverity", async () => {
    const { filterBySeverity } =
      await import("../src/commands/audit/mapper.js");
    const advisories = [
      {
        cveId: "CVE-1",
        packageName: "a",
        currentVersion: "1.0.0",
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

describe("audit fetcher", () => {
  it("extracts concrete versions from simple dependency ranges", async () => {
    const { extractAuditVersion } =
      await import("../src/commands/audit/fetcher.js");

    expect(extractAuditVersion("1.2.3")).toBe("1.2.3");
    expect(extractAuditVersion("^1.2.3")).toBe("1.2.3");
    expect(extractAuditVersion("~1.2.3")).toBe("1.2.3");
    expect(extractAuditVersion("workspace:*")).toBeNull();
    expect(extractAuditVersion(">=1.2.3 <2.0.0")).toBeNull();
  });
});
