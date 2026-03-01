import { describe, it, expect } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("audit parser", () => {
  it("returns defaults with no args", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    const opts = parseAuditArgs([]);
    expect(opts.fix).toBe(false);
    expect(opts.dryRun).toBe(false);
    expect(opts.reportFormat).toBe("table");
    expect(opts.sourceMode).toBe("auto");
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

  it("parses --summary shorthand", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    const opts = parseAuditArgs(["--summary"]);
    expect(opts.reportFormat).toBe("summary");
  });

  it("parses --source github", async () => {
    const { parseAuditArgs } = await import("../src/commands/audit/parser.js");
    const opts = parseAuditArgs(["--source", "github"]);
    expect(opts.sourceMode).toBe("github");
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
        sources: ["osv"] as const,
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
        sources: ["osv"] as const,
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
        sources: ["github"] as const,
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
        sources: ["osv"] as const,
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
        sources: ["osv"] as const,
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
        sources: ["github"] as const,
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
        sources: ["osv"] as const,
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
        sources: ["osv"] as const,
      },
    ];
    const result = filterBySeverity(advisories, undefined);
    expect(result).toHaveLength(1);
  });

  it("summarizes advisories by affected package", async () => {
    const { summarizeAdvisories } =
      await import("../src/commands/audit/mapper.js");
    const advisories = [
      {
        cveId: "GHSA-1",
        packageName: "axios",
        currentVersion: "0.21.0",
        severity: "high" as const,
        vulnerableRange: "<0.21.2",
        patchedVersion: "0.21.2",
        title: "t",
        url: "",
        sources: ["osv"] as const,
      },
      {
        cveId: "GHSA-2",
        packageName: "axios",
        currentVersion: "0.21.0",
        severity: "medium" as const,
        vulnerableRange: "<0.30.0",
        patchedVersion: "0.30.0",
        title: "t",
        url: "",
        sources: ["github"] as const,
      },
      {
        cveId: "GHSA-3",
        packageName: "lodash",
        currentVersion: "4.17.15",
        severity: "high" as const,
        vulnerableRange: "<4.17.21",
        patchedVersion: "4.17.21",
        title: "t",
        url: "",
        sources: ["osv"] as const,
      },
    ];

    const packages = summarizeAdvisories(advisories);
    expect(packages).toHaveLength(2);
    expect(packages[0]?.packageName).toBe("axios");
    expect(packages[0]?.advisoryCount).toBe(2);
    expect(packages[0]?.patchedVersion).toBe("0.30.0");
    expect(packages[0]?.sources).toEqual(["github", "osv"]);
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

describe("audit targets", () => {
  it("resolves versions from package-lock.json for complex manifest ranges", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rainy-audit-npm-lock-"));
    await writeFile(
      path.join(root, "package-lock.json"),
      JSON.stringify(
        {
          name: "demo",
          lockfileVersion: 3,
          packages: {
            "": {
              dependencies: { axios: ">=1.0.0 <2.0.0" },
            },
            "node_modules/axios": {
              version: "1.6.8",
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const { resolveAuditTargets } =
      await import("../src/commands/audit/targets.js");
    const resolution = await resolveAuditTargets(
      root,
      [root],
      new Map([
        [
          root,
          [
            {
              name: "axios",
              range: ">=1.0.0 <2.0.0",
              kind: "dependencies" as const,
            },
          ],
        ],
      ]),
    );

    expect(resolution.targets[0]?.version).toBe("1.6.8");
    expect(resolution.resolution.lockfile).toBe(1);
    expect(resolution.resolution.unresolved).toBe(0);
  });

  it("resolves versions from pnpm-lock.yaml importers", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rainy-audit-pnpm-lock-"));
    const pkgDir = path.join(root, "packages", "web");
    await mkdir(pkgDir, { recursive: true });
    await writeFile(
      path.join(root, "pnpm-lock.yaml"),
      [
        "lockfileVersion: '9.0'",
        "importers:",
        "  .:",
        "    dependencies:",
        "      zod:",
        "        specifier: ^4.0.0",
        "        version: 4.3.6",
        "  packages/web:",
        "    dependencies:",
        "      axios:",
        "        specifier: >=1.0.0 <2.0.0",
        "        version: 1.7.9(react@19.0.0)",
      ].join("\n"),
      "utf8",
    );

    const { resolveAuditTargets } =
      await import("../src/commands/audit/targets.js");
    const resolution = await resolveAuditTargets(
      root,
      [pkgDir],
      new Map([
        [
          pkgDir,
          [
            {
              name: "axios",
              range: ">=1.0.0 <2.0.0",
              kind: "dependencies" as const,
            },
          ],
        ],
      ]),
    );

    expect(resolution.targets[0]?.version).toBe("1.7.9");
    expect(resolution.resolution.lockfile).toBe(1);
  });

  it("resolves versions from bun.lock workspaces", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "rainy-audit-bun-lock-"));
    const pkgDir = path.join(root, "apps", "web");
    await mkdir(pkgDir, { recursive: true });
    await writeFile(
      path.join(root, "bun.lock"),
      [
        "{",
        '  "lockfileVersion": 1,',
        '  "workspaces": {',
        '    "": {',
        '      "dependencies": {',
        '        "zod": "^4.3.6",',
        "      },",
        "    },",
        '    "apps/web": {',
        '      "dependencies": {',
        '        "axios": "1.7.9",',
        "      },",
        "    },",
        "  },",
        "}",
      ].join("\n"),
      "utf8",
    );

    const { resolveAuditTargets } =
      await import("../src/commands/audit/targets.js");
    const resolution = await resolveAuditTargets(
      root,
      [pkgDir],
      new Map([
        [
          pkgDir,
          [
            {
              name: "axios",
              range: ">=1.0.0 <2.0.0",
              kind: "dependencies" as const,
            },
          ],
        ],
      ]),
    );

    expect(resolution.targets[0]?.version).toBe("1.7.9");
    expect(resolution.resolution.lockfile).toBe(1);
  });
});

describe("audit sources", () => {
  it("reports partial coverage when one source fails", async () => {
    const { fetchAdvisories } = await import("../src/commands/audit/fetcher.js");
    const mockSources = {
      osv: {
        name: "osv" as const,
        async fetch() {
          return {
            advisories: [
              {
                cveId: "GHSA-1",
                packageName: "axios",
                currentVersion: "1.0.0",
                severity: "high" as const,
                vulnerableRange: "<1.1.0",
                patchedVersion: "1.1.0",
                title: "t",
                url: "",
                sources: ["osv"] as const,
              },
            ],
            warnings: [],
            health: {
              source: "osv" as const,
              status: "ok" as const,
              attemptedTargets: 1,
              successfulTargets: 1,
              failedTargets: 0,
              advisoriesFound: 1,
            },
          };
        },
      },
      github: {
        name: "github" as const,
        async fetch() {
          return {
            advisories: [],
            warnings: ["GitHub Advisory DB unavailable for all 1 audit target."],
            health: {
              source: "github" as const,
              status: "failed" as const,
              attemptedTargets: 1,
              successfulTargets: 0,
              failedTargets: 1,
              advisoriesFound: 0,
              message: "timeout",
            },
          };
        },
      },
    };

    const result = await fetchAdvisories(
      [
        {
          name: "axios",
          version: "1.0.0",
          packageDir: "/tmp/demo",
          manifestRange: "^1.0.0",
          resolution: "manifest",
        },
      ],
      {
        concurrency: 4,
        registryTimeoutMs: 1000,
        sourceMode: "all",
      },
      mockSources,
    );

    expect(result.advisories).toHaveLength(1);
    expect(result.sourceHealth).toHaveLength(2);
    expect(
      result.warnings.some((item) =>
        item.includes("[ADVISORY_SOURCE_DEGRADED]"),
      ),
    ).toBe(true);
  });

  it("merges source health for total source failure", async () => {
    const { fetchAdvisories } = await import("../src/commands/audit/fetcher.js");
    const mockSources = {
      osv: {
        name: "osv" as const,
        async fetch() {
          return {
            advisories: [],
            warnings: ["OSV.dev unavailable for all 1 audit target."],
            health: {
              source: "osv" as const,
              status: "failed" as const,
              attemptedTargets: 1,
              successfulTargets: 0,
              failedTargets: 1,
              advisoriesFound: 0,
              message: "network",
            },
          };
        },
      },
      github: {
        name: "github" as const,
        async fetch() {
          return {
            advisories: [],
            warnings: ["GitHub Advisory DB unavailable for all 1 audit target."],
            health: {
              source: "github" as const,
              status: "failed" as const,
              attemptedTargets: 1,
              successfulTargets: 0,
              failedTargets: 1,
              advisoriesFound: 0,
              message: "timeout",
            },
          };
        },
      },
    };

    const result = await fetchAdvisories(
      [
        {
          name: "axios",
          version: "1.0.0",
          packageDir: "/tmp/demo",
          manifestRange: "^1.0.0",
          resolution: "manifest",
        },
      ],
      {
        concurrency: 4,
        registryTimeoutMs: 1000,
        sourceMode: "all",
      },
      mockSources,
    );

    expect(result.advisories).toHaveLength(0);
    expect(result.sourceHealth.every((item) => item.status === "failed")).toBe(
      true,
    );
  });
});

describe("audit rendering", () => {
  it("renders source health details for terminal users", async () => {
    const { renderAuditSourceHealth } =
      await import("../src/commands/audit/mapper.js");

    const rendered = renderAuditSourceHealth([
      {
        source: "osv",
        status: "ok",
        attemptedTargets: 4,
        successfulTargets: 4,
        failedTargets: 0,
        advisoriesFound: 6,
      },
      {
        source: "github",
        status: "partial",
        attemptedTargets: 4,
        successfulTargets: 3,
        failedTargets: 1,
        advisoriesFound: 7,
        message: "timeout",
      },
    ]);

    expect(rendered.includes("Sources:")).toBe(true);
    expect(rendered.includes("OSV.dev")).toBe(true);
    expect(rendered.includes("GitHub Advisory DB")).toBe(true);
    expect(rendered.includes("PARTIAL")).toBe(true);
    expect(rendered.includes("timeout")).toBe(true);
  });
});
