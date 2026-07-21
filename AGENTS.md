# ASIN Lens Agent 入口

## 模块树（一眼看）

> 仅开发自用（进度 / 对号入座）。**不进客户前端。**

| 区块 | kb | 职责 |
|------|-----|------|
| `mod/contracts` | 01 | own/竞品 · 词指标 · 双报告契约 |
| `mod/frontend` | 02 | 我的/竞品 UI · 氛围（模块树不进客户页） |
| `mod/collect` | 03 + vendor | SS+Sif 采集 · 清洗 |
| `mod/report` | 04 | 异动日报 ≠ 行业/优化报告 |
| `mod/infra` | 05 | Schema · pooler · migrate |
| `mod/vendor` | vendor/sif-mcp | Sif 能力边界 |

进度：`docs/kb/07-changelog-*.md`

1. **全局守则**（模块树 + 洁癖底线 + 本地入库/按需 push）：`.cursor/rules/asin-lens-sop.mdc`（alwaysApply）  
2. **知识库树**：[`docs/kb/INDEX.md`](docs/kb/INDEX.md)  
3. **契约优先**：[`docs/kb/01-contracts.md`](docs/kb/01-contracts.md)  
4. **Sif 能力边界**：[`docs/vendor/sif-mcp/sif-mcp-tool-schema.json`](docs/vendor/sif-mcp/sif-mcp-tool-schema.json)  
5. **变更总结**：对应模块的 [`docs/kb/07-changelog-*.md`](docs/kb/07-changelog-mod-report.md)（可只本地）  
6. **洁癖收尾**：个人 skill `neat-freak`（说「洁癖」）；对齐结果默认本地入库  

## 文件规则（打开相关代码时）

| 规则 | 场景 |
|------|------|
| `asin-lens-contracts` | 角色 / keywordTraffic / 双报告 |
| `asin-lens-collect-report` | 采集与报告管线 |
| `asin-lens-frontend` | 我的/竞品 UI |
| `asin-lens-infra` | Schema / pooler / migrate |
| `asin-lens-vendor` | 外部 MCP schema |

开新对话声明模块：`mod/collect` | `mod/report` | `mod/frontend` | `mod/infra` | `mod/contracts`
