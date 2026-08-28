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

- Vercel：`vercel.json` Cron（与 GHA 同日程；Hobby 曾哑火，8/28 验到约 09:52 写入，更像 Vercel 触发）  
- `DATABASE_URL`：Vercel Production 必须与本机 `.env.local` 指向同一 Postgres；**Pause** 会 `tenant/user not found`  
- 现役工程：`C:\cursor\Cursor skills\asin-lens`  
- 查数：Dashboard → **Table Editor** → `public`（不是 Storage）  

## 关键环境变量（见 `.env.example`）

`ADMIN_TOKEN`、`DATABASE_URL`、MCP keys、飞书、Zoho SMTP、`CRON_SECRET` 等  

## 建议分支

`mod/infra`
