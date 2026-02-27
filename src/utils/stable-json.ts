function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    sorted[key] = sortValue(value[key]);
  }
  return sorted;
}

export function stableStringify(value: unknown, indent = 2): string {
  return JSON.stringify(sortValue(value), null, indent);
}
