# 07 · 变更总结 · mod/contracts（我的 / 竞品 ASIN）

> 分支：`mod/contracts` · 日期：2026-07-19  
> 用途：push / 合入前必读摘要；详细契约见 `01-contracts.md`

## 一句话

把「同质监控 ASIN」升级为 **可选我的 ASIN + 竞品 ASIN**，并 **另出行业/优化报告**（与异动日报分离）；Sif 采集以官方 MCP schema 为能力边界。

## 产品

| 项 | 约定 |
|----|------|
| 我的 ASIN | 可选；1+ 变体；可手输 / CSV `role=own` / 从竞品标记 |
| 竞品 ASIN | 默认；旧数据一律 competitor |
| 无 own | 仅行业竞品报告 |
| 有 own | 行业报告 + 可优化项（流量词、定价、文案；CVR 手填基准） |
| 分散型流量 | 前三词份额 &lt;70% → 只下结论「分散型流量」，深挖另区 |
| 词转化 | Sif **无** ASIN×词 CVR → `no_result`；`manual_cvr_60d` 作我方基准 |
| 竞价/花费 | 有源才出；无源 `no_result`（bid 常来自 SS `traffic_keyword`） |

## 契约 / Schema

- `asins.role`、`asins.manual_cvr_60d`
- `asin_snapshots.keyword_traffic`
- 新表 `industry_opt_reports`（与 `daily_reports` 分离）
- 迁移：`drizzle/0001_own_competitor.sql`
- API：`PATCH .../asins/:id`；`POST/GET .../industry-opt-reports`；`POST /api/admin/migrate`

## 采集（Sif schema 对齐）

真源：`docs/vendor/sif-mcp/sif-mcp-tool-schema.json`

1. SS `asin_detail`（`marketplace`）  
2. SS `traffic_keyword`  
3. Sif `market_get_asin_keyword_signals`（`country`，`time_type=lately`，`time_value=7`）  
4. Sif `ops_get_listing_traffic_overview`（`country`，`timePieceType=latelyDay`）  

禁止：Sif `asin_detail`；把 SS `purchaseRate` 写成 Sif 转化。

## 前端

- 项目详情：我的 / 竞品两区、「生成行业/优化报告」、60 天 CVR 手填 + 后台路径小字提示  
- CSV 模板含 `role` 列  

## Cursor 规则（已写入）

| 文件 | 内容 |
|------|------|
| `asin-lens-sop.mdc` | 产品中心 + SOP（always） |
| `asin-lens-contracts.mdc` | 角色 / 词指标 / 双报告 |
| `asin-lens-collect-report.mdc` | 采集链 + 报告 |
| `asin-lens-frontend.mdc` | 我的/竞品 UI |
| `asin-lens-infra.mdc` | 迁移 / pooler |
| `asin-lens-vendor.mdc` | Sif schema 真源 |

## 运维注意

- 本机直连 Supabase IPv6 常超时 → 用 Transaction **pooler** 连接串  
- 部署后执行 `0001` SQL 或 `POST /api/admin/migrate`  
- 生产若只跟 `main`，需合入本分支后网页才更新  

## 冒烟（参考）

`npx tsx scripts/smoke-own-competitor.mjs`  
样例：我的 `B0CCRKDW1K` / 竞品 `B0CBF4T1V3` — 标题价带与分散型流量结构可出；词 CVR 按边界无结果。
