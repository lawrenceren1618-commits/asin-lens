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
- **`push` 口令**：补 changelog（若需）→ 本地 commit → push  
- **`准备上新`**：估上下文；≥约 70% 则交接 → 按下一任务拆模块并生成开聊模板  
- `SideQuote` 中英字号上调；日中/暮色参照朝阳微调  
- **上半区清晰天空**：与朝阳同色系透亮 + 日照光晕（忌冷蓝 / 空雾）；布局基线锁定  

## 主要文件

- `src/lib/research/traffic-source.ts`（+ test）  
- `industry-opt.ts` / `industry-opt-format.ts` / `metrics.ts`  
- `app-shell.tsx` / `side-quote.tsx` / `globals.css`  
- `docs/kb/02-frontend.md` / `04-report.md`  

## 冒烟

- 单测：`traffic-source` + industry opt format 含「流量来源」  
- 有快照后：项目页「生成行业/优化报告」应出现流量来源行（旧快照无结构化字段时可能 `no_result`，需再采集）  
