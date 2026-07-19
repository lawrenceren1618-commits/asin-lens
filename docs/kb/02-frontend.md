# 02 · 前端

## 壳层

- `AppShell`：登录、导航、氛围  
- 氛围：`atmosphere.ts` + `AtmospherePanel`（可收起）  
- 旁侧花语：`SideQuote`（中英舒缓文案，轻融画面，可读但不抢戏）  
- 字色方案固定，不手选；自定义背景可上传并自动选 ink  

> **模块树不是产品 UI**：`mod/*` ↔ `docs/kb/*` 的对照写在知识库 `INDEX.md` / Cursor 规则里，给开发提醒用；不要再挂到客户可见页面。

## 页面

| 路由 | 组件 | 用途 |
|------|------|------|
| `/projects` | `projects-dashboard` | 项目列表 |
| `/projects/[id]` | `project-detail` | 我的/竞品 ASIN、采集、图、行业优化报告、日报、报错清单 |
| `/reports` | `reports-dashboard` | 日报阅读 |
| `/rules` | `rules-dashboard` | 源优先级 + 后续能力入口 |
| `/debug` | MCP 调试 | 旧控制台 |

## 项目详情要点

- ASIN 分两区：**我的**（可选，可多变体）与 **竞品**（默认）  
- 可将竞品「标为我的」；CSV `role` 列：`own` / `competitor`  
- 我的 ASIN 可手填近 60 天整体转化率（小字提示亚马逊后台路径）  
- 「生成行业/优化报告」与异动日报分离  

## UI 原则

- **布局基线锁定**：保持当前壳层结构（顶栏 + 主栏 + 旁侧花语 + 底部营地）；后续只在此基础上微调，不做大改版  
- **上半区必须是清晰天空**：与下半朝阳同色系透亮（暖金/晨曦），须有日照光晕；忌冷蓝、忌灰蒙空雾  
- 旁侧花语轻融画面，无画板抢戏；字号以「不显眼但不费劲」为准  
- 文案强调：清楚 / 可追溯 / 可总结  

## 客户端设置

- `client-settings.ts`：源优先级、已解决 issue id  
- `client-auth.ts`：`ApiError` 可带 `failures` 清单  
