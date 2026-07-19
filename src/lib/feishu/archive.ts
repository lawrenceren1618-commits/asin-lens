import "server-only";

import { appendRecords, ensureTable } from "@/lib/feishu/client";
import type { asinChangeLog } from "@/lib/db/schema";

type ChangeLog = typeof asinChangeLog.$inferSelect;

const archiveFields = [
  { field_name: "去重键", type: 1 },
  { field_name: "ASIN", type: 1 },
  { field_name: "站点", type: 1 },
  { field_name: "有效起", type: 1 },
  { field_name: "有效止", type: 1 },
  { field_name: "标题", type: 1 },
  { field_name: "价格", type: 1 },
  { field_name: "销量", type: 2 },
  { field_name: "排名", type: 2 },
  { field_name: "购物车", type: 1 },
  { field_name: "流量", type: 1 },
  { field_name: "流量词", type: 1 },
];

export async function syncChangeToFeishu(input: {
  projectId: string;
  asin: string;
  market: string;
  log: ChangeLog;
}) {
  if (!process.env.FEISHU_BITABLE_APP_TOKEN) return;

  const tableName = `项目归档_${input.projectId.slice(0, 8)}`;
  const tableId = await ensureTable(tableName, archiveFields);
  const keywords = Array.isArray(input.log.topKeywords)
    ? input.log.topKeywords.join(", ")
    : "";

  await appendRecords(tableId, [
    {
      fields: {
        去重键: `${input.asin}_${input.market}_${input.log.effectiveFrom}`,
        ASIN: input.asin,
        站点: input.market,
        有效起: input.log.effectiveFrom,
        有效止: input.log.effectiveTo,
        标题: input.log.title ?? "",
        价格: input.log.price ?? "",
        销量: input.log.sales ?? 0,
        排名: input.log.rank ?? 0,
        购物车: input.log.cart ?? "",
        流量: input.log.traffic ?? "",
        流量词: keywords,
      },
    },
  ]);
}
