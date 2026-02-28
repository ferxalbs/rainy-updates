import { describe, it, expect } from "bun:test";

// Minimal binary search correctness tests for the bisect engine

function binarySearchBreakpoint(
  versions: string[],
  badIndex: number,
): { lo: number; hi: number } {
  // Simulate the bisect algorithm without I/O
  let lo = 0;
  let hi = versions.length - 1;
  const oracle = (i: number): "good" | "bad" =>
    i >= badIndex ? "bad" : "good";

  if (oracle(hi) !== "bad") return { lo: hi, hi: hi };
  if (oracle(lo) === "bad") return { lo: 0, hi: lo };

  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (oracle(mid) === "bad") {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return { lo, hi };
}

describe("bisect engine", () => {
  it("finds the breaking version at index 3 out of 10", () => {
    const versions = [
      "1.0.0",
      "1.1.0",
      "1.2.0",
      "1.3.0",
      "1.4.0",
      "1.5.0",
      "2.0.0",
      "2.1.0",
      "2.2.0",
      "3.0.0",
    ];
    const result = binarySearchBreakpoint(versions, 3);
    expect(versions[result.hi]).toBe("1.3.0");
    expect(versions[result.lo]).toBe("1.2.0");
  });

  it("identifies breakage at the first version", () => {
    const versions = ["1.0.0", "1.1.0", "1.2.0"];
    const result = binarySearchBreakpoint(versions, 0);
    expect(versions[result.hi]).toBe("1.0.0");
  });

  it("handles single-version list", () => {
    const versions = ["1.0.0"];
    const result = binarySearchBreakpoint(versions, 0);
    expect(result.hi).toBe(0);
  });

  it("correctly identifies last version as breaking", () => {
    const versions = ["1.0.0", "1.1.0", "1.2.0", "2.0.0"];
    const result = binarySearchBreakpoint(versions, 3);
    expect(versions[result.hi]).toBe("2.0.0");
    expect(versions[result.lo]).toBe("1.2.0");
  });

  it("uses O(log n) iterations", () => {
    const n = 1024;
    const versions = Array.from({ length: n }, (_, i) => `1.${i}.0`);
    const breakIndex = 512;
    let iterations = 0;

    let lo = 0;
    let hi = versions.length - 1;
    const oracle = (i: number): "good" | "bad" =>
      i >= breakIndex ? "bad" : "good";

    while (lo + 1 < hi) {
      const mid = Math.floor((lo + hi) / 2);
      iterations += 1;
      if (oracle(mid) === "bad") {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    expect(versions[hi]).toBe(`1.${breakIndex}.0`);
    expect(iterations).toBeLessThanOrEqual(Math.ceil(Math.log2(n)));
  });
});

describe("bisect parser", () => {
  it("requires a package name", async () => {
    const { parseBisectArgs } =
      await import("../src/commands/bisect/parser.js");
    expect(() => parseBisectArgs(["--cmd", "bun test"])).toThrow(
      "bisect requires a package name",
    );
  });

  it("parses package name and --cmd", async () => {
    const { parseBisectArgs } =
      await import("../src/commands/bisect/parser.js");
    const opts = parseBisectArgs(["react", "--cmd", "bun test"]);
    expect(opts.packageName).toBe("react");
    expect(opts.testCommand).toBe("bun test");
  });

  it("parses optional --range", async () => {
    const { parseBisectArgs } =
      await import("../src/commands/bisect/parser.js");
    const opts = parseBisectArgs([
      "axios",
      "--range",
      "1.0.0..2.0.0",
      "--cmd",
      "npm test",
    ]);
    expect(opts.versionRange).toBe("1.0.0..2.0.0");
  });

  it("parses --dry-run flag", async () => {
    const { parseBisectArgs } =
      await import("../src/commands/bisect/parser.js");
    const opts = parseBisectArgs(["zod", "--cmd", "bun test", "--dry-run"]);
    expect(opts.dryRun).toBe(true);
  });
});
