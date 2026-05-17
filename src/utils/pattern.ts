export function matchesPattern(value: string, pattern?: string): boolean {
  if (!pattern || pattern.trim() === "") {
    return true;
  }
  const glob = new Bun.Glob(pattern);
  return glob.match(value);
}
