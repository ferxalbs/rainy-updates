import { expect, test } from "bun:test";
import { buildShellInvocation } from "../src/utils/shell.js";

test("buildShellInvocation uses POSIX shell conventions outside Windows", () => {
  const invocation = buildShellInvocation("bun test", "darwin", {
    SHELL: "/bin/zsh",
  });

  expect(invocation.shell).toBe("/bin/zsh");
  expect(invocation.args).toEqual(["-lc", "bun test"]);
});

test("buildShellInvocation uses COMSPEC on Windows", () => {
  const invocation = buildShellInvocation("bun test", "win32", {
    COMSPEC: "C:\\Windows\\System32\\cmd.exe",
  });

  expect(invocation.shell).toContain("cmd.exe");
  expect(invocation.args).toEqual(["/d", "/s", "/c", "bun test"]);
});

