import { expect, test } from "bun:test";
import { applyRangeStyle, classifyDiff, pickTargetVersion, pickTargetVersionFromAvailable } from "../src/utils/semver.js";

test("pickTargetVersion returns null when patch target is not available", () => {
  const result = pickTargetVersion("^1.2.3", "1.3.0", "patch");
  expect(result).toBeNull();
});

test("pickTargetVersion returns latest for major target", () => {
  const result = pickTargetVersion("^1.2.3", "2.0.0", "major");
  expect(result).toBe("2.0.0");
});

test("classifyDiff detects minor", () => {
  expect(classifyDiff("^1.2.3", "1.4.0")).toBe("minor");
});

test("applyRangeStyle preserves prefix", () => {
  expect(applyRangeStyle("~1.2.3", "1.2.8")).toBe("~1.2.8");
});

test("pickTargetVersionFromAvailable chooses highest patch on current minor line", () => {
  const result = pickTargetVersionFromAvailable("^1.2.3", ["1.2.4", "1.2.9", "1.3.0"], "1.3.0", "patch");
  expect(result).toBe("1.2.9");
});

test("pickTargetVersionFromAvailable chooses highest minor within current major", () => {
  const result = pickTargetVersionFromAvailable("^1.2.3", ["1.2.9", "1.9.1", "2.0.0"], "2.0.0", "minor");
  expect(result).toBe("1.9.1");
});
