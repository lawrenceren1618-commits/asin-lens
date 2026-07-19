# 02 · 前端

## 壳层

- `AppShell`：登录、导航、氛围、**右侧模块树** `ModuleMap`  
- 氛围：`atmosphere.ts` + `AtmospherePanel`（可收起）  
- 字色方案固定，不手选；自定义背景可上传并自动选 ink  

## 页面

| 路由 | 组件 | 用途 |
|------|------|------|
| `/projects` | `projects-dashboard` | 项目列表 |
| `/projects/[id]` | `project-detail` | ASIN、采集、图、报错清单 |
| `/reports` | `reports-dashboard` | 日报阅读 |
| `/rules` | `rules-dashboard` | 源优先级 + 后续能力入口 |
| `/debug` | MCP 调试 | 旧控制台 |

## UI 原则

- 上半区清朗，勿加雾罩挡朝阳  
- 旁侧花语轻融画面，无画板抢戏  
- 文案强调：清楚 / 可追溯 / 可总结  

## 客户端设置

- `client-settings.ts`：源优先级、已解决 issue id  
- `client-auth.ts`：`ApiError` 可带 `failures` 清单  
