# 01 · 交叉契约（Interfaces）

改任何模块前先对齐这里，禁止另起一套模型。

## 规范指标 `SnapshotMetrics`

定义：`src/lib/research/metrics.ts`  
字段：`title, price, sales, rank, cart, traffic, topKeywords, rawRefs`  
流程：`cleanToMetrics` → `verifyMetrics` → 才可写库  

## 源优先级 `SourcePriorityConfig`

定义：`src/lib/research/source-priority.ts`  
存：浏览器 `localStorage`（`asin-lens-source-priority-v1`）  
采集请求体可带 `sourcePriority`；合并时靠前源优先，字段可单独覆盖。

## 流水线报错 `PipelineIssue`

定义：`src/lib/research/pipeline-error.ts`  
阶段：`mcp | clean | verify | db | report | export`  
UI：`IssueChecklist`（可勾已处理）

## 报告规范 `ReportCanonical`

定义：`src/lib/research/report-format.ts`  
先 `verifyReportCanonical`，再 `formatDailyReportMd`，再推送。

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/collect` | `{ projectId \| asinId, sourcePriority? }` |
| GET | `/api/reports` | 日报列表 |
| CRUD | `/api/projects...` | 项目与 ASIN |
| GET | `/api/cron/daily-report` | Cron，需 `CRON_SECRET` |

## 核心表（语义）

- `projects` / `asins`  
- `asin_snapshots`：按日规范快照 + `raw_refs`  
- `asin_change_log`：变化区间  
- `daily_reports`：`summary_md` + `anomalies`  
- `job_runs`：任务状态  

Schema 真源：`src/lib/db/schema.ts`、`drizzle/0000_init.sql`
