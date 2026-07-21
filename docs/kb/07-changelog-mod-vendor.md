# Changelog · mod/vendor

## 2026-07-21 — SellerSprite MCP 官方文档入库

- 新增 `docs/vendor/sellersprite-mcp/`：
  - `sellersprite-mcp-api.md`：开放平台 43 接口全文（来源 open.sellersprite.com/api）
  - `sellersprite-mcp-tools.json`：机器可读工具目录 + ASIN Lens 在用标注
  - `README.md`：调用规则摘要（`marketplace`、在用工具、与 Sif 边界对照）
- 更新 `asin-lens-vendor.mdc`、`AGENTS.md`、`docs/kb/INDEX.md`、`03-collect.md`、`01-contracts.md`（cvr / purchaseRate）
- 规则要点：SS 站点参数用 `marketplace`；`purchaseRate` 不入 `keywordTraffic.cvr`；`traffic_source`≠ Sif 流量结构
