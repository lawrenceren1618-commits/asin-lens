# 04 · 报告与通知（Report）

## 生成

- Cron：`/api/cron/daily-report`（北京时间约定见 README）  
- 逻辑：`generateDailyReports`（`report.ts`）  
- 异动阈值：价格 ≥5%，流量 ≥20%  

## 导出管线

1. 组装 `ReportCanonical`  
2. `prepareReportExport` 核对  
3. `formatDailyReportMd` → 人读 Markdown  
4. 写入 `daily_reports`  
5. 飞书 webhook + Zoho 邮件（可 skip）  

## 规划中（见 /rules 后续入口）

- 人工核对台（清洗前后对照）  
- CSV/Excel 导出  
- 源健康检查  

## 建议分支

`mod/report`
