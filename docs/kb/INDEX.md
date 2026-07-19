# ASIN Lens 知识库索引（模块树）

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
└── ../vendor/sif-mcp/  ← Sif MCP 官方 tool schema
```

## Cursor 规则 ↔ 知识库

| 规则文件 | always / globs | 对齐 |
|----------|----------------|------|
| `asin-lens-sop.mdc` | always | 产品中心 + SOP |
| `asin-lens-contracts.mdc` | contracts/types | 01-contracts |
| `asin-lens-collect-report.mdc` | research/api | 03 + 04 |
| `asin-lens-frontend.mdc` | components/pages | 02-frontend |
| `asin-lens-infra.mdc` | db/drizzle | 05-infra |
| `asin-lens-vendor.mdc` | vendor + mcp | sif-mcp-tool-schema |

## 建议 Git 分支 ↔ 知识库

| 分支 | 知识库 | 范围 |
|------|--------|------|
| `mod/contracts` | 01-contracts | 类型、API 约定、优先级 schema |
| `mod/frontend` | 02-frontend | 仪表盘、氛围、报错清单 UI |
| `mod/collect` | 03-collect | MCP、metrics、collect API |
| `mod/report` | 04-report | 日报、format、邮件/飞书 |
| `mod/infra` | 05-infra | Schema、Vercel、env |
| `mod/workflow` | 06-git-workflow | 仅文档/规则，不改业务 |

## 开聊模板

```
按 ASIN Lens 守则（全局 SOP）。
本区块：mod/collect
必读：docs/kb/01-contracts.md + docs/kb/03-collect.md
先给行动计划，等我确认执行后再改代码。不要 push。
```
