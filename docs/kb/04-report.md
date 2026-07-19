# 04 · 报告与通知（Report）

## 生成

- Cron：`/api/cron/daily-report`（北京时间约定见 README）  
- 逻辑：`generateDailyReports`（`report.ts`）  
- 异动阈值：价格 ≥5%，流量 ≥20%  

## 行业/优化报告（独立）

- API：`POST /api/projects/:id/industry-opt-reports`  
- 逻辑：`generateIndustryOptReport`（`industry-opt.ts`）  
- 规范：`IndustryOptCanonical` → 核对 → Markdown  
- 无我的 ASIN → 仅行业竞品；有 → 行业 + 可优化项  
- 分散型流量只下结论，不深挖  

### 流量来源段

- 源：Sif `ops_get_listing_traffic_overview`（采集写入 `rawRefs.trafficSource`）  
- 解析：`traffic-source.ts`  
- 报告输出：自然 vs 广告占比 + SP / SP推荐 / SB / SBV；无源 → `no_result`  

### 词转化旁注

- Sif 无 ASIN×词 CVR → 词行 `no_result`  
- 我的 ASIN：有手填 `manual_cvr_60d` 时，词行旁注「对照手填整体 CVR」  

## 导出管线（异动日报）

1. 组装 `ReportCanonical`  
2. `prepareReportExport` 核对  
3. `formatDailyReportMd` → 人读 Markdown  
4. 写入 `daily_reports`  
5. 飞书 webhook + Zoho 邮件（可 skip）  

## 规划中（见 /rules 后续入口）

- 人工核对台（清洗前后对照）  
- CSV/Excel 导出  
- 源健康检查  
- 分散型流量深挖功能区  

## 建议分支

`mod/report`
