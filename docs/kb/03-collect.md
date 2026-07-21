# 03 · 采集管线（Collect）

## 路径

`POST /api/collect` → `collectProject` / `collectAsin`  
实现：`src/lib/research/collect.ts`

## 单 ASIN 步骤

1. SellerSprite `asin_detail`（`marketplace`）→ 标题/价/BSR  
2. SellerSprite `traffic_keyword` → 词日均 searches / bid（可选）  
3. Sif `market_get_asin_keyword_signals`（`country` + `time_type=lately` + `time_value=7`）→ 主词与份额  
4. Sif `ops_get_listing_traffic_overview`（`country` + `timePieceType=latelyDay`）→ 流量来源  
5. `prepareMetricsForStorage`（含 `keywordTraffic`）→ Upsert `asin_snapshots`  
6. 有变化则写/延展 `asin_change_log`，并尝试飞书归档  
7. 更新 `asins.lastSyncedAt`  

能力边界（禁止臆造字段）：

- **SellerSprite**：`docs/vendor/sellersprite-mcp/`（在用 `asin_detail` + `traffic_keyword`；站点参数 **`marketplace`**；`purchaseRate` 不入 cvr）
- **Sif**：`docs/vendor/sif-mcp/sif-mcp-tool-schema.json`（**无** `asin_detail`、**无** ASIN×词转化率；站点参数 **`country`**）

注意：SS `traffic_source` = 关键词流向 ≠ Sif Listing 自然/广告结构。

## 失败策略

- 单 ASIN 失败 → `PipelineIssue`，不阻断同批其它  
- 全失败 → HTTP 422 + `failures[]`  
- UI 用报错清单逐项勾掉  

## 测试

`src/lib/research/metrics.test.ts` — 清洗、优先级、核对拒绝空数据  

## 建议分支

`mod/collect`
