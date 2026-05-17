export function getRuntimeCwd(): string {
  return process.cwd();
}

export function getRuntimeArgv(): string[] {
  return Bun.argv.slice(2);
}

export function readEnv(name: string): string | undefined {
  return Bun.env[name];
}

export function writeStdout(message: string): void {
  Bun.stdout.write(message);
}

export function writeStderr(message: string): void {
  Bun.stderr.write(message);
}

export function setRuntimeExitCode(code: number): void {
  process.exitCode = code;
}

export function exitProcess(code: number): never {
  Bun.exit(code);
}
