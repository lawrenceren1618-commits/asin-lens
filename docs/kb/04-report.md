# 04 · 报告与通知（Report）

## 生成

- Cron：`GET /api/cron/daily-report`（Vercel `0 1 * * *` UTC = **北京 09:00**）  
  - 鉴权：`Authorization: Bearer` 匹配 `CRON_SECRET` **或** `ADMIN_TOKEN`（Vercel 定时用前者；手测可用后者）  
  - **失败告警**：鉴权失败 / 管线步骤失败（含部分采集 failures）/ 未捕获异常 → 飞书短告警（`cron-alert.ts` + `FEISHU_BOT_WEBHOOK`）；成功出报告仍走原推送  
- **自动项目**（`projects.auto_daily`）：采集 → **异动日报** + **行业/优化报告** → 飞书/邮件  
  - 实现：`runAutoDailyPipeline`（`auto-daily.ts`）  
  - 异动：`generateDailyReportForProject`（报告日取上海当日，对照更早快照）  
  - 行业：`generateIndustryOptReport`（默认佣金/头程费率）  
  - `?mode=legacy`：旧行为，全项目只跑异动、不采集  
- 异动阈值：价格 ≥5%，流量 ≥20%  
- 非自动项目：不进 Cron；仍可手动采集 /「生成最新」  
- 生产域名：`https://asin-lens.tuneyas.com`（勿用旧/预览 `*.vercel.app` 当主站）  

## 行业/优化报告（独立）

- API：`POST /api/projects/:id/industry-opt-reports`（可选 body `{ commerceRates }`）  
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

### 单位经济段（≠ 异动日报）

- 每 ASIN：`unitEconomics`（单个均价、配送、FBA、佣金、头程、利润粗算）  
- 行业概览：`unitAvgPriceMin` / `Max` / `Median`  
- 费率：客户端 `/rules` → localStorage `asin-lens-commerce-rates-v1` → 请求体 `commerceRates`（默认佣金 15%、头程五模式各 6 CNY/kg）  
- 利润粗算：有单个均价即出数；缺配送/FBA/头程时**缺项未扣**（见契约）  
- UI：`industry-opt-report-view` 结构化展示；与 `summaryMd` 经济行一致  

## 导出管线（异动日报）

1. 组装 `ReportCanonical`  
2. `prepareReportExport` 核对  
3. `formatDailyReportMd` → 人读 Markdown  
4. 写入 `daily_reports`  
5. 飞书 webhook + Zoho 邮件（可 skip）  

## 规划中（见 /rules 后续入口）

- 若 MCP 额度紧：可将行业报告改为每 3 天（异动仍每日）——路线「备用」  
- 人工核对台（清洗前后对照）  
- CSV/Excel 导出  
- 源健康检查  
- 分散型流量深挖功能区  
- 佣金按大类表覆盖  

## 建议分支

`mod/report`
