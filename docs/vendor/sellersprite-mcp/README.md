# SellerSprite MCP（卖家精灵）

> **官方真源**：[`sellersprite-mcp-api.md`](./sellersprite-mcp-api.md)（43 个 MCP Code，来自 [open.sellersprite.com/api](https://open.sellersprite.com/api)）  
> **机器可读目录**：[`sellersprite-mcp-tools.json`](./sellersprite-mcp-tools.json)  
> **上传原文归档**：[`mcp-api-source.md`](./mcp-api-source.md)（与全文同源；勿再放工程根目录）  
> 改工具名、入参、字段映射前 **必须先读真源**，禁止臆造字段。

## 与 ASIN Lens 的关系

| 项 | 约定 |
|----|------|
| 调用封装 | `src/lib/mcp/sellersprite.ts` → MCP URL + `secret-key` |
| 站点参数 | **`marketplace`**（非 Sif 的 `country`） |
| 采集在用 | `asin_detail`、`traffic_keyword`（见 `collect.ts`） |
| 词级 CVR | 响应可有 `purchaseRate`，**契约禁止写入** `keywordTraffic.cvr`（与 Sif schema 边界一致，用手填 `manual_cvr_60d`） |
| 流量来源 | SS `traffic_source` = **关键词流向**；Listing 自然/广告结构用 **Sif** `ops_get_listing_traffic_overview`，二者勿混 |

## 通用约定（摘要）

- 认证：Header / MCP query `secret-key`（控制台 [open.sellersprite.com](https://open.sellersprite.com)）
- REST Base：`https://api.sellersprite.com`；MCP：`https://mcp.sellersprite.com/mcp`（见 env）
- 市场：`US` / `JP` / `UK` / `DE` / `FR` / `IT` / `ES` / `CA` / `IN`
- 错误码：`400` 参数 · `401` 密钥 · `403` 权限 · `429` 限流 · `500`/`503` 服务端

## 本产品在用工具

### `asin_detail`（必用）

- 入参：`marketplace` + `asin`
- 映射：`title` · `price` · `bsrRank`→rank · `sellerName`→cart 等（清洗见 `metrics.ts`）

### `traffic_keyword`（可选补缺）

- 入参：`marketplace` + `asin`（可选 `month` / 分页）
- 映射：`items[].searches` / `calculatedWeeklySearches`→dailyTraffic；`bid`→bid  
- **不映射**：`purchaseRate`→cvr

## 目录分组（43）

| 分组 | 数量 | MCP Code 示例 |
|------|------|----------------|
| ASIN 分析 | 6 | `asin_detail` · `asin_prediction` · `keepa_info` · `asin_sales_trend` · `asin_coupon_trend` · `asin_detail_with_coupon_trend` |
| 商品与竞品 | 3 | `competitor_lookup` · `product_research` · `product_node` |
| 关键词 | 5 | `keyword_miner` · `keyword_research` · `keyword_research_trends` · `keyword_order` · `bsr_prediction` |
| 流量 | 6 | `traffic_keyword` · `traffic_keyword_stat` · `traffic_source` · `traffic_listing` · `traffic_listing_stat` · `traffic_extend` |
| 市场分析 | 14 | `market_research*` 系列 |
| ABA / 趋势 | 5 | `aba_research_*` · `google_trend` · `review` |
| 商标 | 4 | `trademark_*` |

完整参数与响应表见 `sellersprite-mcp-api.md`；调用前用 `sellersprite-mcp-tools.json` 核对 `name` 是否存在。
