# ASIN Lens 知识库索引（模块树）

> **一眼看**：全局规则 `.cursor/rules/asin-lens-sop.mdc`（alwaysApply）置顶有同款表——新对话自动带上。  
> 本页为详表。开新对话可复制下方模板；模块树无需再贴（规则已注入）。

> 开新对话时复制：「按 ASIN Lens 守则；本区块只做：`mod/<名>`；先读 `docs/kb/<文件>`」

```
asin-lens/
├── 00-overview.md      ← 产品原则与全景
├── 01-contracts.md     ← 交叉契约（优先读）
├── 02-frontend.md      ← UI / AppShell / 规则页
├── 03-collect.md       ← 采集 · 清洗 · 核对 · 入库
├── 04-report.md        ← 日报 · 行业优化报告 · 通知
├── 05-infra.md         ← DB · Cron · Env · 部署
├── 06-git-workflow.md  ← 分支命名 · commit · 发版
├── 07-changelog-*.md   ← 模块变更总结（push 前必写）
└── ../vendor/
    ├── sif-mcp/           ← Sif MCP 官方 tool schema
    └── sellersprite-mcp/  ← 卖家精灵 MCP（README + tools.json + 全文 API）
```

## Cursor 规则 ↔ 知识库

| 规则文件 | always / globs | 对齐 |
|----------|----------------|------|
| `asin-lens-sop.mdc` | always | 业务：模块组成 + 跨模块影响（须 push） |
| （本机）`asin-lens-chat-hygiene.mdc` | always · 用户规则 | 对话卫生 / 省上下文（**不 push**） |

| `asin-lens-contracts.mdc` | contracts/types | 01-contracts |
| `asin-lens-collect-report.mdc` | research/api | 03 + 04 |
| `asin-lens-frontend.mdc` | components/pages | 02-frontend |
| `asin-lens-infra.mdc` | db/drizzle | 05-infra |
| `asin-lens-vendor.mdc` | vendor + mcp | sif-mcp + sellersprite-mcp |

## 建议 Git 分支 ↔ 知识库

| 分支 | 知识库 | 范围 |
|------|--------|------|
| `mod/contracts` | 01-contracts | 角色 own/competitor、keywordTraffic、IndustryOpt |
| `mod/frontend` | 02-frontend | 我的/竞品两区、行业优化报告入口 |
| `mod/collect` | 03-collect + vendor/sif | SS+Sif 工具链、清洗核对 |
| `mod/report` | 04-report | 异动日报 vs 行业/优化报告 |
| `mod/infra` | 05-infra | Schema 0001、pooler、migrate |
| `mod/vendor` | docs/vendor/sif-mcp + sellersprite-mcp | Sif/SS 官方 schema（不臆造字段） |
| `mod/workflow` | 06 + 07-changelog | 规则/总结，不改业务 |

## 开聊模板（复制）

```
按 ASIN Lens 守则（全局 SOP）。
本区块：mod/<名>
必读：docs/kb/01-contracts.md + docs/kb/<对应文件>
背景：docs/kb/07-changelog-*.md
先给行动计划，等我确认执行后再改代码。
我说 push = 上传业务组成部分与跨模块规则；对话卫生仅本机。
```
