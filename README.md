# asin-lens

Next.js 仪表盘：管理项目与 ASIN，调用 SellerSprite / Sif MCP 采集数据，写入 Supabase Postgres，压缩变更同步飞书，并通过飞书机器人与 Zoho 邮件发送北京时间 09:00 昨日报告。

## 本地启动

```bash
npm install
copy .env.example .env.local
npm run dev
```

打开 http://localhost:3000/projects ，右上角填入并保存 `ADMIN_TOKEN`。

## 数据库建表（必做一次）

本机直连 Supabase 若出现 IPv6 超时，请：

1. 在 Supabase → **Project Settings → Database → Connection string** 复制 **Transaction pooler**（host 含 `pooler`，端口 `6543`，用户形如 `postgres.<project-ref>`），写入本地与 Vercel 的 `DATABASE_URL`  
2. 在 **SQL Editor** 粘贴执行增量迁移：[`drizzle/0001_own_competitor.sql`](drizzle/0001_own_competitor.sql)  
   （或部署后 `POST /api/admin/migrate`，需 `ADMIN_TOKEN`）

也可在网络正常时尝试：

```bash
node scripts/apply-schema.mjs
node scripts/fix-db-url.mjs   # 探测 pooler 并改写 .env.local（不打印密钥）
```

## 环境变量

见 [`.env.example`](.env.example)。本地 `.env.local` 与 Vercel Environment Variables 需同步：

- `DATABASE_URL`、`ADMIN_TOKEN`
- MCP / 飞书 bitable
- `ZOHO_SMTP_*`、`REPORT_EMAIL_TO`
- `CRON_SECRET`（Cron 鉴权）
- 可选 `FEISHU_BOT_WEBHOOK`（群机器人推送）

## 使用流程

1. 创建项目
2. 单条添加 ASIN，或下载 `/templates/asin-import.csv` 上传
3. 点击「采集全部 ASIN」
4. 查看折线图与下方日报区
5. Vercel Cron 每天 UTC 01:00（北京时间 09:00）调用 `/api/cron/daily-report`

MCP 手工调试入口：`/debug`

## 部署

```bash
npm test
npm run lint
npm run build
git add .
git commit -m "Add project dashboard and collection pipeline"
git push
```

在 Vercel 配置相同环境变量后自动部署。
