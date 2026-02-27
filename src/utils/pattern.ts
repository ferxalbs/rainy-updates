export function matchesPattern(value: string, pattern?: string): boolean {
  if (!pattern || pattern.trim() === "") {
    return true;
  }
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"))
    .join(".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(value);
}
