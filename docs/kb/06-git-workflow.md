# 06 · Git 与 Cursor 工作流

## 混合策略（已采用）

| 层 | 作用 | 形式 |
|----|------|------|
| 全局守则 | 行为约束，每次对话自动带上 | `.cursor/rules/asin-lens-sop.mdc` |
| 模块知识库 | 业务细节，按需阅读 | `docs/kb/*.md` |
| Vendor schema | 外部 MCP 能力边界 | `docs/vendor/**` |
| 文件规则 | 打开相关代码时提醒读 kb | `asin-lens-*.mdc` globs |
| 页面模块树 | 不忘文件名与分支名 | 右侧 `ModuleMap` |

## 针对性开发节奏

1. 从右侧树或 `INDEX.md` 选模块  
2. `git checkout -b mod/<模块>`  
3. 新对话粘贴开聊模板（见 INDEX）  
4. Agent 出计划 → 你「确认执行」→ 再改代码  
5. 本地 commit；不 push  
6. 你下令发版时：Changelog + 版本名 → 再 push  

## 禁止

- 未确认改 Schema/跨模块契约  
- 擅自 push / force push  
- 在一个对话里无边界地改所有模块  
