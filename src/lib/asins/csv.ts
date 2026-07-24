import { isValidAsin } from "./parse";

export function parseAsinCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      rows: [] as Array<{
        asin: string;
        market: string;
        note?: string;
        role?: "own" | "competitor";
      }>,
      errors: ["空文件"],
    };
  }

  const header = lines[0].split(",").map((cell) => cell.trim().toLowerCase());
  const asinIdx = header.findIndex((h) => h === "asin");
  const marketIdx = header.findIndex((h) => h === "market" || h === "站点");
  const noteIdx = header.findIndex((h) => h === "note" || h === "备注");
  const roleIdx = header.findIndex(
    (h) => h === "role" || h === "类型" || h === "归属",
  );

  if (asinIdx < 0) {
    return {
      rows: [],
      errors: ["缺少 asin 列，请使用模板表头：asin,market,note,role"],
    };
  }

  const rows: Array<{
    asin: string;
    market: string;
    note?: string;
    role?: "own" | "competitor";
  }> = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(",").map((cell) => cell.trim());
    const asin = (cols[asinIdx] ?? "").toUpperCase();
    if (!asin) {
      errors.push(`第 ${i + 1} 行：asin 为空`);
      continue;
    }
    if (!isValidAsin(asin)) {
      errors.push(`第 ${i + 1} 行：asin 格式无效（${asin}）`);
      continue;
    }

    let role: "own" | "competitor" | undefined;
    if (roleIdx >= 0) {
      const raw = (cols[roleIdx] ?? "").toLowerCase();
      if (raw === "own" || raw === "我的" || raw === "自有") role = "own";
      else if (
        raw === "competitor" ||
        raw === "竞品" ||
        raw === "" ||
        raw === "comp"
      ) {
        role = "competitor";
      } else {
        errors.push(`第 ${i + 1} 行：role 无效（${cols[roleIdx]}），用 own/competitor`);
        continue;
      }
    }

    rows.push({
      asin,
      market: (marketIdx >= 0 ? cols[marketIdx] : "US")?.toUpperCase() || "US",
      note: noteIdx >= 0 ? cols[noteIdx] : undefined,
      role,
    });
  }

  return { rows, errors };
}
