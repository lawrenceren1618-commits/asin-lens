# 06 · Git 与 Cursor 工作流

## 混合策略（已采用）

| 层 | 作用 | 形式 |
|----|------|------|
| 全局守则 | 行为约束，每次对话自动带上 | `.cursor/rules/asin-lens-sop.mdc` |
| 模块知识库 | 业务细节，按需阅读 | `docs/kb/*.md` |
| Vendor schema | 外部 MCP 能力边界 | `docs/vendor/**` |
| 文件规则 | 打开相关代码时提醒读 kb | `asin-lens-*.mdc` globs |
| 页面模块树 | 不忘文件名与区块名 | **全局规则** `asin-lens-sop.mdc` 置顶表（每对话自动带）；详表 `INDEX.md` |

## 针对性开发节奏

1. 从全局规则置顶「模块树」或 `docs/kb/INDEX.md` 选模块  
2. `git checkout -b mod/<模块>`  
3. 新对话粘贴开聊模板（见 INDEX）；模块树已由 alwaysApply 规则自动带上  
4. Agent 出计划 → 你「确认执行」→ 再改代码  
5. **你说 `push`**：Agent 自动 ① 补齐 `07-changelog-*.md`（若需要）→ ② 本地 commit → ③ push（无需再单独说 commit）  
6. **你说 `准备上新`**：估上下文；约 ≥70% 则建议换对话 → 你给下一任务 → Agent 拆模块并生成开聊模板  
7. 发版另需 Changelog + 版本名确认  

## 禁止

- 未确认改 Schema/跨模块契约  
- **无总结就 push**  
- 擅自 force push  
- 在一个对话里无边界地改所有模块  
- 把开发用模块树挂到客户可见前端  
