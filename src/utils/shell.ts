export interface ShellInvocation {
  shell: string;
  args: string[];
  display: string;
}

export function buildShellInvocation(
  command: string,
  runtimePlatform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): ShellInvocation {
  if (runtimePlatform === "win32") {
    const shell = env.COMSPEC?.trim() || "cmd.exe";
    const args = ["/d", "/s", "/c", command];
    return {
      shell,
      args,
      display: [shell, ...args].join(" "),
    };
  }

  const shell = env.SHELL?.trim() || "sh";
  const args = ["-lc", command];
  return {
    shell,
    args,
    display: [shell, ...args].join(" "),
  };
}

