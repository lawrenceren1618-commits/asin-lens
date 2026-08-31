# 05 · 基础设施（Infra）

## 数据库

- Postgres（Supabase）：`DATABASE_URL`  
- ORM：Drizzle — `src/lib/db/*`  
- 初始化 SQL：`drizzle/0000_init.sql`  
- 增量：`drizzle/0001_own_competitor.sql`（role / manual_cvr / keyword_traffic / industry_opt_reports）  
- 辅助：`scripts/apply-schema.mjs`（按文件名顺序应用全部 `.sql`）  
- `ensureAutoDailyColumn`：先查 `information_schema`；列已在则跳过 `ALTER`（pooler `:6543` 常拒 DDL）  
- 增量 SQL 仍用 `POST /api/admin/migrate`（`ADMIN_TOKEN`），不要让 Cron 热路径依赖 DDL  

**改表必须先行动计划，等「确认执行」。**

## 部署

- Vercel：`vercel.json` Cron 为日更主调度（UTC 01:00；Hobby 约 09:40–09:50 写出）。Hobby 暂停过会哑火，库 Pause 仍须 Restore  
  - GHA `daily-report` 仅手动 Run，不定时（避免与 Vercel 双跑）  
- `DATABASE_URL`：Vercel Production 必须与本机 `.env.local` 指向同一 Postgres；**Pause** 会 `tenant/user not found`  
- 现役工程：`C:\cursor\Cursor skills\asin-lens`  
- 查数：Dashboard → **Table Editor** → `public`（不是 Storage）  

## 关键环境变量（见 `.env.example`）

`ADMIN_TOKEN`、`DATABASE_URL`、MCP keys、飞书、Zoho SMTP、`CRON_SECRET` 等  

## 建议分支

`mod/infra`
