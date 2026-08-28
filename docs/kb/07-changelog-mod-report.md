# 07 · 变更总结 · mod/report

> 分支：`mod/report` · 日期：2026-07-19  
> 用途：push / 合入前必读摘要

## 一句话

行业/优化报告补上 **流量来源（自然 vs 广告渠道）** 与词转化旁注；同时把开发用「模块树」移出客户前端，并加大旁侧中英舒缓文案可读性（背景以朝阳为参照微调）。

## 报告

| 项 | 约定 |
|----|------|
| 流量来源 | 从 `rawRefs.trafficSource`（采集时由 `ops_get_listing_traffic_overview` 解析）写入行业/优化报告 |
| 无源 | `no_result` + 原因，不臆造占比 |
| 渠道 | 自然 / 广告 · SP / SP推荐 / SB / SBV |
| 词 CVR | 仍无 ASIN×词转化；own 有手填整体 CVR 时词行旁注对照 |

## 前端（氛围，非核心产品）

- 移除客户可见的 `ModuleMap`；模块树**永不进前台**，只在全局规则 / `AGENTS.md` / kb 里方便对号入座、查未优化区块  
- **模块树一眼看**：`asin-lens-sop.mdc`（alwaysApply）置顶 + `AGENTS.md`  
- **`push` 口令**：上传**业务组成部分 + 跨模块影响规则**（含业务 kb/契约/vendor）；**对话卫生**仅本机不传  
- **`准备上新` / 洁癖流程**：本机 `~/.cursor/rules/asin-lens-chat-hygiene.mdc` + skill `neat-freak`（不 push）  
- `SideQuote` 中英字号上调；远景静默点缀，忌海报抢戏  

## 工作区

- 现役工程路径：`C:\cursor\Cursor skills\asin-lens`  
- 若仍有 Desktop 旧副本，确认真源后再删，避免双份混淆  

## 主要文件

- `src/lib/research/traffic-source.ts`（+ test）  
- `industry-opt.ts` / `industry-opt-format.ts` / `metrics.ts`  
- `app-shell.tsx` / `side-quote.tsx` / `globals.css`  
- `docs/kb/02-frontend.md` / `04-report.md`  

## 冒烟

- 单测：`traffic-source` + industry opt format 含「流量来源」  
- 有快照后：项目页「生成行业/优化报告」应出现流量来源行（旧快照无结构化字段时可能 `no_result`，需再采集）  

---

## 2026-07-23 — 单位经济（单个均价 / 佣金 / 头程 / 利润粗算）

- `IndustryOptCanonical` 每 ASIN 增加 `unitEconomics`；行业概览增加 `unitAvgPriceMin/Max/Median`
- 计算：`unit-economics.ts`；费率：`commerce-rates.ts`（默认佣金 15%、头程五模式各 6 CNY/kg）
- 利润粗算：有单个均价即出数；配送/FBA/头程缺项未扣（契约写明）
- API：`POST .../industry-opt-reports` 可带 `{ commerceRates }`；UI `/rules` 可配
- 与异动日报分离；依赖采集 `rawRefs.listingExtras`（含 keepa）
- 单测：`unit-economics.test.ts`
- **修复**：`keepa_info` 的 `price`/`bsr` 趋势数组不得覆盖 `asin_detail` 标量售价/排名（`assignProductFields` + 测例）
- table cloth 重采验收：6/10 Pack 单个均价、15% 佣金、FBA/头程、利润粗算均有数
- 策略约定：打开读落库秒出（A）；自动项目每日 Cron 采集+双报告

## 2026-07-23 — 自动项目日更管线

- `runAutoDailyPipeline`：仅 `auto_daily` 项目；采集 → 异动（当日）→ 行业 → 推送
- Cron 默认走该管线；`?mode=legacy` 旧全量异动

## 2026-07-25 — 生产日更哑火排查与 Cron 鉴权放宽

- 根因：Vercel `DATABASE_URL` 曾错库；`CRON_SECRET` 与本地不一致 → 生产手调 Cron 401；北京 09:00 未写出当日快照/报告
- 补跑：本机对共享库跑通 2026-07-25 table cloth（采集 2 + 日报 + 行业）
- 代码：`/api/cron/daily-report` 接受 `CRON_SECRET` **或** `ADMIN_TOKEN` Bearer（`cad2abe`）
- 生产主站：`asin-lens.tuneyas.com`；migrate 支持按语句拆分 / `only:0002`；缺列时可降级列表

## 2026-07-26 — 验自动日更 + Cron 失败告警

- **验收**：共享库 `table cloth`（`auto_daily=true`）验库时仅有 2026-07-25 快照×2 + 日报 + 行业；**无 07-26** 行；`job_runs` 最近成功采集亦止于 07-25 → 北京 09:00 生产 Cron 再次未写出当日数据（鉴权/超时/未触发待 Vercel 日志确认）
- **补跑**：本机 `GET /api/cron/daily-report`（ADMIN_TOKEN）对共享库写出 2026-07-26：采集 2 + 日报 + 行业（`ok: true`）
- **代码**：`cron-alert.ts` 汇总管线问题；Cron route 鉴权失败 / 步骤失败 / uncaught → 飞书短告警；单测 `cron-alert.test.ts`
- 响应：`ok` 在有告警问题时为 `false`（仍返回各项目明细）

## 2026-08-12 — GitHub Actions 主调度 + 漏日 reports-only

- **根因收窄**：Hobby Observability 多次无 Cron 调用；手补跑（本机）成功。用户确认 `DATABASE_URL` 无误后，主因视为 **Vercel Cron 未稳定触发**（非业务 SQL / 非「只有口头才写库」）
- **主调度**：`.github/workflows/daily-report.yml`（`0 1 * * *` UTC + `workflow_dispatch`）打生产 `/api/cron/daily-report`；需 GitHub Secret `CRON_SECRET`
- **代码**：`runAutoDailyReportsOnly` + Cron `?mode=reports-only&date=`（漏日只补报告）
- **运维**：建议 Vercel Cron Disable 以免双跑；Supabase 免费 Pause 仍须单独防
- 补跑：8/12 本机全量成功；8/4–8/11 等缺口可按 reports-only 补

## 2026-08-27 — 生产 Cron 500：pooler 拒 ALTER auto_daily

- **现象**：GHA / 手测生产 `GET /api/cron/daily-report` 鉴权已通，约 0.6–4s 即 500；JSON `error` = `Failed query: ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_daily ...`
- **根因**：`listAutoDailyProjects` 把 `ensureAutoDailyColumn()` 当硬前置；Transaction pooler 拒 DDL。列多半已在（8/12 本机全量成功），不必每次 ALTER
- **代码**：`ensureAutoDailyColumn` 先查 `information_schema`，列在则跳过 ALTER；列表/详情/Cron 在 DDL 失败时仍 `SELECT auto_daily`
- **未做**：未改 Vercel `DATABASE_URL`（用户当轮无法查看）。8/13–8/27 漏日等 Redeploy 后 GHA 手测通过再补

## 2026-08-27 — 续：Pause 导致 Failed query（非缺列）

- Redeploy `69694d7` 后 Cron 500 变为 `SELECT ... auto_daily`；`GET /api/projects` 降级 SELECT 也 503
- 本机同一 `DATABASE_URL` 报 `(ENOTFOUND) tenant/user postgres.… not found` → **Supabase 免费 Pause**，不是「缺 auto_daily 列」
- drizzle 只回 `Failed query`；GHA `curl -f` 不打印 body → 已入库 `flattenQueryError` + GHA 去 `-f`（见下条同日段）

## 2026-08-28 — Restore 后日更验过；邮件通、飞书 webhook 未配

- **8/27 22:52** GHA `#4` 手跑 success（`workflow_dispatch`）：快照+双报告 `2026-08-27`
- **8/28 09:52** 自动写入 `2026-08-28` 快照×2 + 日报 + 行业（采集 `2/2`）。Actions **无** `schedule` 记录 → 更像 Vercel Cron（同 UTC 01:00，Hobby 晚点）
- 邮件 `REPORT_EMAIL_TO` 已收到；`sent_feishu_at` 空：`FEISHU_BOT_WEBHOOK` 未配。App ID/Secret/Bitable **≠** 群通知（Bitable 只归档异动行）
- 数据在 **Table Editor / public**（`asin_snapshots` / `daily_reports` / `industry_opt_reports`），不在 Storage
- 可视化在站点项目页；邮件是 Markdown
- 漏日 8/13–8/26 无快照，不能回放采集
- 工程路径：`C:\cursor\Cursor skills\asin-lens`
- **诊断上线**：`flattenQueryError`（cause 链）+ Cron/projects 错误回传；GHA 去掉 `curl -f`，非 200 仍打印 JSON
- **暂缓**：飞书 webhook、关一边 Cron——先保任务完成；明日看是否双写再调（额度次要）
