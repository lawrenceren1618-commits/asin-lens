# 04 · 报告与通知（Report）

## 生成

- Cron：`GET /api/cron/daily-report`（目标 **美西 03:00**，抓取并标注 **已过完的美西前一天**）  
  - **业务日**：`lastCompletedPacificDay`（`America/Los_Angeles` 日历日 − 1）。邮件主题、快照 `snapshot_date`、双报告 `report_date` 用它，不用北京日、不用邮箱显示时区  
  - **主调度**：Vercel Cron 两条 UTC：`0 10 * * *`（夏令 = 美西 03:00）+ `0 11 * * *`（冬令 = 美西 03:00）。冬令 10:00 UTC 是美西 02:00 → 接口 `skipped: wait_pacific_3am`；同业务日已采齐 → `skipped: already_collected`。手测加 `?force=1`  
  - **GHA**：`.github/workflows/daily-report.yml` **只留** `workflow_dispatch` 手测（Secrets `CRON_SECRET`）  
  - 鉴权：`Authorization: Bearer` 匹配 `CRON_SECRET` **或** `ADMIN_TOKEN`  
  - **失败告警**：鉴权失败 / 管线步骤失败（含部分采集 failures）/ 未捕获异常 → 飞书短告警（`cron-alert.ts` + `FEISHU_BOT_WEBHOOK`）；成功出报告仍走原推送  
  - `?mode=reports-only&date=YYYY-MM-DD`：仅补指定日双报告（不采集；漏日回溯用）  
- **自动项目**（`projects.auto_daily`）：采集 → **异动日报** + **行业/优化报告** → 飞书/邮件  
  - 实现：`runAutoDailyPipeline`（`auto-daily.ts`）；漏日报告：`runAutoDailyReportsOnly`  
  - 异动：`generateDailyReportForProject`（报告日 = 美西已过完的一天，对照更早快照）  
  - 行业：`generateIndustryOptReport`（默认佣金/头程费率）  
  - `?mode=legacy`：旧行为，全项目只跑异动、不采集  
- 异动阈值：价格 ≥5%，流量 ≥20%  
- 非自动项目：不进 Cron；仍可手动采集 /「生成最新」  
- 生产域名：`https://asin-lens.tuneyas.com`（勿用旧/预览 `*.vercel.app` 当主站）  
- 耗时：采集依赖 MCP，整段常 **数分钟**（Hobby 函数上限 300s）；DB 读不是主瓶颈  
- Supabase 免费项目久未访问会 **Pause**，定时会写库失败；外出前需知 Restore / 或升级  
- **Transaction pooler 常拒 DDL**：`ensureAutoDailyColumn` 先查 `information_schema`，列已在则不 `ALTER`；`listAutoDailyProjects` 不把 `ALTER` 当硬前置。否则 Cron 会在 ~1s 内 500（`Failed query: ALTER TABLE ... auto_daily`）  
- GHA `daily-report` **不要** `curl -f`：非 200 也要打印响应 JSON（含 `flattenQueryError` 的 postgres cause）  
- Production `DATABASE_URL` 必须与本机 `.env.local` 同一库；连错库或 **Supabase Pause** 时普通 SELECT 也会 Failed query  
- **飞书两条线**：`FEISHU_BOT_WEBHOOK` = 群自定义机器人推报告/告警；`FEISHU_APP_ID` / `SECRET` / `BITABLE` = 采集异动写入多维表格。未配 webhook 则 skip（`sent_feishu_at` 空）。Bitable 只在 **新插入** `asin_change_log` 时追加；缺口日后指标有变化必须插新行（勿走空分支）  
- 邮件：`ZOHO_SMTP_*` + `REPORT_EMAIL_TO`；主题 `[asin-lens] …`。可视化看站点项目页，邮件是 Markdown  
- 落库查 **Table Editor → public**（`daily_reports` 等），不要看 Storage  

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
