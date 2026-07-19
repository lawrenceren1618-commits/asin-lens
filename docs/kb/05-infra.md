# 05 · 基础设施（Infra）

## 数据库

- Postgres（Supabase）：`DATABASE_URL`  
- ORM：Drizzle — `src/lib/db/*`  
- 初始化 SQL：`drizzle/0000_init.sql`  
- 增量：`drizzle/0001_own_competitor.sql`（role / manual_cvr / keyword_traffic / industry_opt_reports）  
- 辅助：`scripts/apply-schema.mjs`（按文件名顺序应用全部 `.sql`）  

**改表必须先行动计划，等「确认执行」。**

## 部署

- Vercel：`vercel.json` Cron  
- 密钥只在 `.env.local` / Vercel Env，勿提交  

## 关键环境变量（见 `.env.example`）

`ADMIN_TOKEN`、`DATABASE_URL`、MCP keys、飞书、Zoho SMTP、`CRON_SECRET` 等  

## 建议分支

`mod/infra`
