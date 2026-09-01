# 03 · 采集管线（Collect）

## 路径

`POST /api/collect` → `collectProject` / `collectAsin`  
实现：`src/lib/research/collect.ts`

## 单 ASIN 步骤

1. SellerSprite `asin_detail`（`marketplace`）→ 标题/价/BSR / 卖家运费等  
2. SellerSprite `traffic_keyword` → 词日均 searches / bid（可选）  
3. SellerSprite `keepa_info`（可选）→ FBA 费用 / 包装重尺寸 / 大类回退 → 写入 `rawRefs.listingExtras`  
4. Sif `market_get_asin_keyword_signals`（`country` + `time_type=lately` + `time_value=7`）→ 主词与份额  
5. Sif `ops_get_listing_traffic_overview`（`country` + `timePieceType=latelyDay`）→ 流量来源  
6. `prepareMetricsForStorage`（含 `keywordTraffic` + `listingExtras`）→ Upsert `asin_snapshots`（`snapshot_date` = 美西已过完的一天）  
7. 写/延展 `asin_change_log`（决策：`planChangeLogWrite`）：无变化则延展 `effectiveTo`；同日重采有变化则原地更新；**上一笔 `effectiveTo` 早于业务日且有变化 → 旧段不动、插新行**，再尝试飞书归档  
8. 更新 `asins.lastSyncedAt`  

能力边界（禁止臆造字段）：

- **SellerSprite**：`docs/vendor/sellersprite-mcp/`（在用 `asin_detail` + `traffic_keyword` + `keepa_info`；站点参数 **`marketplace`**；`purchaseRate` 不入 cvr）
- **Sif**：`docs/vendor/sif-mcp/sif-mcp-tool-schema.json`（**无** `asin_detail`、**无** ASIN×词转化率；站点参数 **`country`**）

注意：SS `traffic_source` = 关键词流向 ≠ Sif Listing 自然/广告结构。  
`keepa_info` 失败不阻断采集；行业报告单位经济缺 FBA/重量时标缺项。  
合并清洗时：**keepa 趋势数组不得覆盖** `asin_detail` 的标量 `price` / `bsrRank`（见 `assignProductFields`）。

## 失败策略

- 单 ASIN 失败 → `PipelineIssue`，不阻断同批其它  
- 全失败 → HTTP 422 + `failures[]`  
- UI 用报错清单逐项勾掉  

## 测试

`src/lib/research/metrics.test.ts` — 清洗、优先级、核对拒绝空数据  
`src/lib/research/unit-economics.test.ts` — 装量/单个均价/佣金/头程/利润粗算  
`src/lib/research/change-log.test.ts` — 缺口日后有变化须插新异动行  

## 建议分支

`mod/collect`
