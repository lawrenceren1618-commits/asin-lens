# 07 · 变更总结 · mod/frontend

## 2026-07-23 — 创建项目直达详情 + 拒空白名

- `/projects`：点「开始」创建成功后立即进入 `/projects/:id`（采集 / 行业报告页），不再只刷新列表
- 项目名称 trim 后必填；空白/纯空格：前端禁用提交 + API 返回「项目名称不能为空」
- 清理无 ASIN 空壳：`node scripts/cleanup-empty-projects.mjs`（`deleteProjectsWithoutAsins`）

## 2026-07-23 — 同名项目提示 + 后缀

- 创建时若名称已存在：先提示，不落库
- 用户点「坚持创建」：自动命名为 `原名1`（已被占则 `2`、`3`…）
- API：`POST /api/projects` 同名且未确认 → `409` + `suggestedName`；`acceptDuplicateSuffix: true` 时落库带后缀名

## 2026-07-23 — 项目可改名

- 详情页「项目名称」可编辑并保存
- `PATCH /api/projects/:id`：同名提示 + 坚持则加后缀（排除自身）

## 2026-07-23 — 趋势图指标多选 + 时间范围

- 图表选项：价格/流量/销量/排名可勾选（全选/清空）；所选字段才画进趋势图
- 时间范围：近 7/14/30/60/90 天或自定义起止日期
- `GET /api/projects/:id?days=`（7–365，默认 90）按窗口返回快照

## 2026-07-23 — ASIN 识别建档

- 粘贴纯 ASIN 或亚马逊 `/dp/` 链接：先 `extractAsin` 校验（10 位字母数字）
- 格式错：中文提示，**不**调 MCP
- 格式对：「识别建档」→ 入库 + `POST /api/collect`（单 asinId）→ 回显标题/价等
- 共享：`src/lib/asins/parse.ts`；`POST .../asins` 同样拒非法格式

## 2026-07-23 — 我的/竞品分入口 + 多 ASIN 勾选

- 详情页左右两栏：添加我的 ASIN / 添加竞品 ASIN（不再共用 role 下拉）
- 粘贴识别到多个：`extractAsins` + 悬浮框列出全部；勾选为我的，其余竞品；确认后批量建档
- 从「我的」入口粘贴多码时默认全勾为我的；从「竞品」入口默认全不勾

## 2026-07-23 — 行业/优化报告结构化 UI

- 用 `industry_opt_reports.payload`（IndustryOptCanonical）渲染：报告头、行业概览、竞品节、我方可优化
- 最新报告默认展开，历史可折叠；「复制 Markdown」读 `summaryMd`
- payload 缺失/校验失败时回退 `<pre>` 原文
- 组件：`src/components/industry-opt-report-view.tsx`
- 展示单位经济（单个均价 / 佣金 / 头程 / 利润粗算；缺项未扣说明）；`/rules` 可配佣金与头程费率

## 2026-07-23 — 报告可见性 · 流程壳 · 加载加速

- 详情顶栏：面包屑 + 项目名 + 阶段条；报告区上移；首载 `?snapshots=0`
- 趋势与整页解耦；落库秒出 +「生成最新」等待条

## 2026-07-23 — 自动项目 · 每日 09:00 采集+双报告

- `projects.auto_daily` + `drizzle/0002_auto_daily.sql`；详情勾选 / 列表徽章
- Cron `/api/cron/daily-report`：自动项目 → 采集 → 异动日报 → 行业报告 → 飞书/邮件（`maxDuration=300`）
- `?mode=legacy` 保留旧「全项目仅异动」行为
- 打开仍秒出落库版；「生成最新」可手动现算
