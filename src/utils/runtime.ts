export function getRuntimeCwd(): string {
  return process.cwd();
}

export function getRuntimeArgv(): string[] {
  if (typeof Bun !== "undefined") {
    return Bun.argv.slice(2);
  }
  return Bun.argv.slice(2);
}

export function readEnv(name: string): string | undefined {
  if (typeof Bun !== "undefined") {
    return Bun.env[name];
  }
  return Bun.env[name];
}

export function writeStdout(message: string): void {
  process.stdout.write(message);
}

export function writeStderr(message: string): void {
  process.stderr.write(message);
}

export function setRuntimeExitCode(code: number): void {
  process.exitCode = code;
}

export function exitProcess(code: number): never {
  process.exit(code);
}
