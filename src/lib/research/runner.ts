import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  appendRecords,
  ensureTable,
  logFields,
  resolveResultsTable,
  taskFields,
} from "@/lib/feishu/client";
import { callSellerSpriteTool } from "@/lib/mcp/sellersprite";
import { callSifTool } from "@/lib/mcp/sif";
import {
  firstText,
  normalizeToolResult,
  safeJson,
  stableKey,
  type SourceResult,
} from "@/lib/research/normalize";

const toolRequestSchema = z.object({
  tool: z.string().trim().min(1).max(100),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

export const researchRequestSchema = z
  .object({
    market: z.string().trim().max(50).default(""),
    sellerSprite: toolRequestSchema.optional(),
    sif: toolRequestSchema.optional(),
  })
  .refine((value) => value.sellerSprite || value.sif, {
    message: "At least one MCP tool call is required",
  });

export type ResearchRequest = z.infer<typeof researchRequestSchema>;

function shanghaiDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replaceAll("-", "");
}

async function callSources(input: ResearchRequest) {
  const results: SourceResult[] = [];

  if (input.sellerSprite) {
    results.push({
      source: "SellerSprite",
      tool: input.sellerSprite.tool,
      raw: await callSellerSpriteTool(
        input.sellerSprite.tool,
        input.sellerSprite.arguments,
      ),
    });
  }
  if (input.sif) {
    results.push({
      source: "Sif",
      tool: input.sif.tool,
      raw: await callSifTool(input.sif.tool, input.sif.arguments),
    });
  }
  return results;
}

export async function runResearch(untrustedInput: unknown) {
  const input = researchRequestSchema.parse(untrustedInput);
  const taskId = randomUUID();
  const runId = randomUUID();
  const startedAt = new Date();
  const day = shanghaiDay(startedAt);
  const taskTableId = await ensureTable("调研任务", taskFields);
  const logTableId = await ensureTable("运行日志", logFields);

  await appendRecords(taskTableId, [
    {
      fields: {
        任务ID: taskId,
        创建时间: startedAt.toISOString(),
        SellerSprite工具: input.sellerSprite?.tool ?? "",
        Sif工具: input.sif?.tool ?? "",
        参数: safeJson(input),
        状态: "已提交，详见运行日志",
      },
    },
  ]);

  try {
    const sourceResults = await callSources(input);
    const normalized = sourceResults.flatMap(normalizeToolResult);
    const table = await resolveResultsTable(day, normalized.length);
    const seenInRun = new Set<string>();
    const records = normalized.flatMap((item) => {
      const key = stableKey(item, day, input.market);
      if (table.keys.has(key) || seenInRun.has(key)) return [];
      seenInRun.add(key);

      return [
        {
          fields: {
            去重键: key,
            数据源: item.source,
            工具: item.tool,
            任务ID: taskId,
            站点市场: input.market,
            ASIN关键词: firstText(item.data, [
              "asin",
              "ASIN",
              "keyword",
              "关键词",
              "title",
            ]),
            采集时间: startedAt.toISOString(),
            标准化数据: safeJson(item.data),
            原始摘要: item.rawSummary,
          },
        },
      ];
    });

    await appendRecords(table.table_id, records);
    await appendRecords(logTableId, [
      {
        fields: {
          运行ID: runId,
          任务ID: taskId,
          状态: "成功",
          开始时间: startedAt.toISOString(),
          结束时间: new Date().toISOString(),
          写入数量: records.length,
          错误: "",
        },
      },
    ]);

    return {
      runId,
      taskId,
      status: "success" as const,
      received: normalized.length,
      written: records.length,
      skipped: normalized.length - records.length,
      tableId: table.table_id,
      tableName: table.name,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await appendRecords(logTableId, [
      {
        fields: {
          运行ID: runId,
          任务ID: taskId,
          状态: "失败",
          开始时间: startedAt.toISOString(),
          结束时间: new Date().toISOString(),
          写入数量: 0,
          错误: message.slice(0, 8_000),
        },
      },
    ]).catch(() => undefined);
    throw error;
  }
}
