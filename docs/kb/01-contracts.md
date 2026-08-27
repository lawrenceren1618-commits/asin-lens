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
| dailyTraffic / bid | SellerSprite `traffic_keyword` | `searches` / `bid`（或 `calculatedWeeklySearches`）；补缺 |
| cvr | — | **Sif 无 ASIN×词转化率**；SS 有 `purchaseRate` 但**禁止写入 cvr**；报告 `no_result`；own 用手填 `manual_cvr_60d` |
| spend | — | Sif/SS 常无金额 → `no_result` |
| 流量来源 | Sif `ops_get_listing_traffic_overview` | 自然 vs 广告（SP/SB/SBV）；写入 `rawRefs.trafficSource`，行业报告输出 |

流量结构：前三词份额合计 ≥ 70% → `concentrated`；否则 `dispersed`（报告只下结论，深挖另区）  
Sif 入参用 **`country`**（非 marketplace）；关键词信号默认 `time_type=lately` + `time_value=7`。

## 源优先级 `SourcePriorityConfig`

定义：`src/lib/research/source-priority.ts`  
存：浏览器 `localStorage`（`asin-lens-source-priority-v2`）  
采集请求体可带 `sourcePriority`；合并时靠前源优先，字段可单独覆盖。

**产品默认（冲突照此执行）**

| 类别 | 优先源 | 字段 / 管线 |
|------|--------|-------------|
| 非流量 | SellerSprite → Sif | `title` · `price` · `sales` · `rank` · `cart` |
| 流量 | Sif → SellerSprite | `traffic` · `topKeywords`；`keywordTraffic` 合并固定 Sif 主、SS 补缺；`rawRefs.trafficSource` 仅 Sif |

可在 `/rules` 调整；未改时按上表。

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

#### 单位经济 `unitEconomics`（仅行业/优化报告，不进日报）

- 计算：`src/lib/research/unit-economics.ts`；费率：`commerce-rates.ts`  
- 输入：快照 `title` / `price` + `rawRefs.listingExtras`（采集写入）+ 可选 `commerceRates`  
- 装量：标题解析 `N Pack` / `pack of N` 等；解析不到 → `assumed_one`（按 1）  
- **单个均价** = listing 售价 ÷ 装量；行业概览另有 `unitAvgPriceMin/Max/Median`  
- **佣金**：默认售价 15%（`commissionRate`，可在 `/rules` 改）；后续可按大类表覆盖  
- **头程**：五模式（空运 / 海运普船卡派 / 海运快船卡派 / 海运快递派送 / 全程快递派送），默认各 6 CNY/kg；按计费重÷装量  
- **利润粗算** `unitProfitProxyUsd`：有单个均价即给出数值；扣可得的佣金/配送/FBA/头程，**缺项未扣**（非「全缺 → no_result」）  
- FBA / 包装重主要来自 SS `keepa_info`；无源 → 对应字段 `no_result`

#### `rawRefs.listingExtras`

清洗自 SS `asin_detail` + `keepa_info`（字段以 vendor 为准）：`deliveryPrice` · `weight` · `pkgWeight` · `pkgWeightGram`/`weightGram` · `dimensions` · `pkgDimensions` · `bsrLabel`/`rootCategoryLabel` · `nodeLabelPath` · `fulfillment` · `fbaFees`

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| PATCH | `/api/projects/:id` | `{ name, acceptDuplicateSuffix? }` 改名；或 `{ autoDaily }` 开关自动项目 |
| POST | `/api/collect` | `{ projectId \| asinId, sourcePriority? }` |
| GET | `/api/reports` | 日报列表 |
| CRUD | `/api/projects...` | 项目与 ASIN |
| PATCH | `/api/projects/:id/asins/:asinId` | `{ role?, manualCvr60d?, note? }` |
| POST | `/api/projects/:id/industry-opt-reports` | 生成行业/优化报告；可选 body `{ commerceRates }` |
| GET | `/api/cron/daily-report` | 自动项目：采集+异动+行业+推送；`?mode=legacy` 仅异动；`?mode=reports-only&date=YYYY-MM-DD` 仅双报告；`Authorization: Bearer` 须匹配 `CRON_SECRET` **或** `ADMIN_TOKEN`；步骤失败时飞书告警。主调度推荐 GitHub Actions（见 `04-report`） |
| POST | `/api/admin/migrate` | 幂等执行 `drizzle/0001` + `0002` |

## 核心表（语义）

- `projects`（含 `auto_daily`：自动项目日更） / `asins`（含 `role`, `manual_cvr_60d`）  
- `asin_snapshots`：按日规范快照 + `keyword_traffic` + `raw_refs`  
- `asin_change_log`：变化区间  
- `daily_reports`：异动日报  
- `industry_opt_reports`：行业/优化报告（`mode` + `payload` + `summary_md`）  
- `job_runs`：任务状态  

Schema 真源：`src/lib/db/schema.ts`、`drizzle/0000_init.sql`、`drizzle/0001_own_competitor.sql`、`drizzle/0002_auto_daily.sql`
