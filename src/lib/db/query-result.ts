/** Flatten drizzle "Failed query" plus postgres cause into one string. */
export function flattenQueryError(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let i = 0; i < 5 && current != null && !seen.has(current); i += 1) {
    seen.add(current);
    if (current instanceof Error) {
      if (current.message) parts.push(current.message);
      current = current.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return parts.join(" | ") || String(error);
}

/** Normalize drizzle / postgres-js execute() results to a row count. */
export function executeQueryRowCount(result: unknown): number {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === "object" && "length" in result) {
    const n = (result as { length: unknown }).length;
    if (typeof n === "number") return n;
  }
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) return rows.length;
  }
  return 0;
}
