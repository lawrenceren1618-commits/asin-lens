# 03 · 采集管线（Collect）

## 路径

`POST /api/collect` → `collectProject` / `collectAsin`  
实现：`src/lib/research/collect.ts`

## 单 ASIN 步骤

1. 调 SellerSprite / Sif `asin_detail`（失败保留 error 进 raw）  
2. `prepareMetricsForStorage(sources, priority)`  
3. Upsert `asin_snapshots`  
4. 有变化则写/延展 `asin_change_log`，并尝试飞书归档  
5. 更新 `asins.lastSyncedAt`  

## 失败策略

- 单 ASIN 失败 → `PipelineIssue`，不阻断同批其它  
- 全失败 → HTTP 422 + `failures[]`  
- UI 用报错清单逐项勾掉  

## 测试

`src/lib/research/metrics.test.ts` — 清洗、优先级、核对拒绝空数据  

## 建议分支

`mod/collect`
