# 01 · 交叉契约（Interfaces）

改任何模块前先对齐这里，禁止另起一套模型。

## ASIN 角色

`asins.role`：`own` | `competitor`（默认 `competitor`）  
- `own`：我的产品（可选，可多变体）  
- `competitor`：行业竞品  
- 已有数据默认竞品；用户可勾选/手输/CSV `role` 列改为 own  

`asins.manual_cvr_60d`：仅 own 有意义；用户手填子 ASIN 近 60 天整体转化率（%）。

## 规范指标 `SnapshotMetrics`

定义：`src/lib/research/metrics.ts`  
字段：`title, price, sales, rank, cart, traffic, topKeywords, keywordTraffic, rawRefs`  
流程：`cleanToMetrics` → `verifyMetrics` → 才可写库  

### `keywordTraffic`（词级）

定义：`src/lib/research/keyword-traffic.ts`  
官方能力边界真源：`docs/vendor/sif-mcp/sif-mcp-tool-schema.json`  

| 字段 | 主源 | 说明 |
|------|------|------|
| share | Sif `market_get_asin_keyword_signals` | `click_share` / `traffic_share` |
| dailyTraffic / bid | SellerSprite `traffic_keyword` | `searches` / `bid`；补缺 |
| cvr | — | **Sif schema 无 ASIN×词转化率**；报告 `no_result`；我的 ASIN 用手填 `manual_cvr_60d` 作基准 |
| spend | — | Sif/SS 常无金额 → `no_result` |
| 流量来源 | Sif `ops_get_listing_traffic_overview` | 自然 vs 广告（SP/SB/SBV） |

流量结构：前三词份额合计 ≥ 70% → `concentrated`；否则 `dispersed`（报告只下结论，深挖另区）  
Sif 入参用 **`country`**（非 marketplace）；关键词信号默认 `time_type=lately` + `time_value=7`。

## 源优先级 `SourcePriorityConfig`

定义：`src/lib/research/source-priority.ts`  
存：浏览器 `localStorage`（`asin-lens-source-priority-v1`）  
采集请求体可带 `sourcePriority`；合并时靠前源优先，字段可单独覆盖。

## 流水线报错 `PipelineIssue`

定义：`src/lib/research/pipeline-error.ts`  
阶段：`mcp | clean | verify | db | report | export`  
UI：`IssueChecklist`（可勾已处理）

## 报告规范

### 异动日报 `ReportCanonical`

定义：`src/lib/research/report-format.ts`  
先 `verifyReportCanonical`，再 `formatDailyReportMd`，再推送。

### 行业/优化报告 `IndustryOptCanonical`（与日报分离）

定义：`src/lib/research/industry-opt-format.ts`  
生成：`generateIndustryOptReport`  
- 无 own → `mode=industry`  
- 有 own → `mode=industry_plus_own`（行业 + 可优化：流量词/定价/文案 + 手填 CVR 对照）

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/collect` | `{ projectId \| asinId, sourcePriority? }` |
| GET | `/api/reports` | 日报列表 |
| CRUD | `/api/projects...` | 项目与 ASIN |
| PATCH | `/api/projects/:id/asins/:asinId` | `{ role?, manualCvr60d?, note? }` |
| POST | `/api/projects/:id/industry-opt-reports` | 生成行业/优化报告 |
| GET | `/api/cron/daily-report` | Cron，需 `CRON_SECRET` |

## 核心表（语义）

- `projects` / `asins`（含 `role`, `manual_cvr_60d`）  
- `asin_snapshots`：按日规范快照 + `keyword_traffic` + `raw_refs`  
- `asin_change_log`：变化区间  
- `daily_reports`：异动日报  
- `industry_opt_reports`：行业/优化报告（`mode` + `payload` + `summary_md`）  
- `job_runs`：任务状态  

Schema 真源：`src/lib/db/schema.ts`、`drizzle/0000_init.sql`、`drizzle/0001_own_competitor.sql`
