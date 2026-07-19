export function parseAsinCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [] as Array<{ asin: string; market: string; note?: string }>, errors: ["空文件"] };
  }

  const header = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  const asinIdx = header.findIndex((h) => h === "asin");
  const marketIdx = header.findIndex((h) => h === "market" || h === "站点");
  const noteIdx = header.findIndex((h) => h === "note" || h === "备注");

  if (asinIdx < 0) {
    return {
      rows: [],
      errors: ["缺少 asin 列，请使用模板表头：asin,market,note"],
    };
  }

  const rows: Array<{ asin: string; market: string; note?: string }> = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((cell) => cell.trim());
    const asin = (cols[asinIdx] ?? "").toUpperCase();
    if (!asin) {
      errors.push(`第 ${i + 1} 行：asin 为空`);
      continue;
    }
    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      errors.push(`第 ${i + 1} 行：asin 格式无效（${asin}）`);
      continue;
    }
    rows.push({
      asin,
      market: (marketIdx >= 0 ? cols[marketIdx] : "US")?.toUpperCase() || "US",
      note: noteIdx >= 0 ? cols[noteIdx] : undefined,
    });
  }

  return { rows, errors };
}
