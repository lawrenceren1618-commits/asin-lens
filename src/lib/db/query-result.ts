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
