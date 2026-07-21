# ASIN Lens Agent 入口

## 模块树（业务组成部分）

> 仅开发自用（进度 / 对号入座）。**不进客户前端。** 属业务知识，须可远程共享。

| 区块 | kb | 职责 |
|------|-----|------|
| `mod/contracts` | 01 | own/竞品 · 词指标 · 双报告契约 |
| `mod/frontend` | 02 | 我的/竞品 UI · 氛围 |
| `mod/collect` | 03 + vendor | SS+Sif 采集 · 清洗 |
| `mod/report` | 04 | 异动日报 ≠ 行业/优化报告 |
| `mod/infra` | 05 | Schema · pooler · migrate |
| `mod/vendor` | vendor/sif-mcp | Sif 能力边界 |

进度：`docs/kb/07-changelog-*.md`

1. **业务守则**（模块 + 跨模块影响）：`.cursor/rules/asin-lens-sop.mdc`（alwaysApply，**须 push**）  
2. **知识库**：[`docs/kb/INDEX.md`](docs/kb/INDEX.md)  
3. **契约**：[`docs/kb/01-contracts.md`](docs/kb/01-contracts.md)  
4. **Sif 边界**：[`docs/vendor/sif-mcp/sif-mcp-tool-schema.json`](docs/vendor/sif-mcp/sif-mcp-tool-schema.json)  
5. **变更总结**：[`docs/kb/07-changelog-*.md`](docs/kb/07-changelog-mod-report.md)  
6. **对话卫生（本机，不 push）**：`~/.cursor/rules/asin-lens-chat-hygiene.mdc` · skill `neat-freak`  

## 文件规则（打开相关代码时 · 业务）

| 规则 | 场景 |
|------|------|
| `asin-lens-contracts` | 角色 / keywordTraffic / 双报告 |
| `asin-lens-collect-report` | 采集与报告管线 |
| `asin-lens-frontend` | 我的/竞品 UI |
| `asin-lens-infra` | Schema / pooler / migrate |
| `asin-lens-vendor` | 外部 MCP schema |

开新对话声明模块：`mod/collect` | `mod/report` | `mod/frontend` | `mod/infra` | `mod/contracts`
