# ASIN Lens Agent 入口

1. **全局守则**：`.cursor/rules/asin-lens-sop.mdc`（alwaysApply）
2. **知识库树**：[`docs/kb/INDEX.md`](docs/kb/INDEX.md)
3. **契约优先**：[`docs/kb/01-contracts.md`](docs/kb/01-contracts.md)
4. **Sif 能力边界**：[`docs/vendor/sif-mcp/sif-mcp-tool-schema.json`](docs/vendor/sif-mcp/sif-mcp-tool-schema.json)
5. **变更总结（push 前）**：[`docs/kb/07-changelog-mod-contracts.md`](docs/kb/07-changelog-mod-contracts.md)

## 文件规则（打开相关代码时）

| 规则 | 场景 |
|------|------|
| `asin-lens-contracts` | 角色 / keywordTraffic / 双报告 |
| `asin-lens-collect-report` | 采集与报告管线 |
| `asin-lens-frontend` | 我的/竞品 UI |
| `asin-lens-infra` | Schema / pooler / migrate |
| `asin-lens-vendor` | 外部 MCP schema |

开新对话请声明模块：`mod/collect` | `mod/report` | `mod/frontend` | `mod/infra` | `mod/contracts`
