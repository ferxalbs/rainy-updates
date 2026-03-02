export function getRuntimeCwd(): string {
  return process.cwd();
}

export function getRuntimeArgv(): string[] {
  if (typeof process !== "undefined" && Array.isArray(process.argv)) {
    return process.argv.slice(2);
  }
  if (typeof Bun !== "undefined" && Array.isArray(Bun.argv)) {
    return Bun.argv.slice(2);
  }
  return [];
}

export function readEnv(name: string): string | undefined {
  if (typeof Bun !== "undefined") {
    const value = Bun.env[name];
    if (value) return value;
  }
  return process.env[name];
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
