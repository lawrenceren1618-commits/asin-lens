# Amazon 用户调研工作台

Next.js 服务端调用 SellerSprite 和 Sif 远程 MCP，将标准化结果写入飞书多维表格。

## 本地启动

```bash
npm install
copy .env.example .env.local
npm run dev
```

在 `.env.local` 填入新生成的凭据。曾发送到聊天或提交到仓库的密钥必须先撤销，不能继续使用。

## 飞书准备

1. 在飞书开放平台创建企业自建应用。
2. 开启多维表格的查看、创建数据表、新增和读取记录权限。
3. 发布应用版本，并在目标多维表格中添加该应用为可访问成员。
4. 从多维表格 URL 获取 `app_token`，配置 `FEISHU_BITABLE_APP_TOKEN`。

首次运行时应用会自动创建：

- `调研任务`
- `运行日志`
- `结果_YYYYMMDD`（接近 19,500 条后自动创建带序号的表）

## MCP

- SellerSprite 使用 Streamable HTTP，服务端在运行时把独立密钥拼入 `secret-key` 查询参数。
- Sif 默认使用 Streamable HTTP，服务端在运行时同时发送 `secret-key` 查询参数和请求头。若账号文档要求 SSE，设置 `SIF_TRANSPORT=sse`。
- 如果 Sif 的认证头不同，使用 `SIF_AUTH_HEADER` 和 `SIF_AUTH_SCHEME` 调整。

启动后先在页面输入 `ADMIN_TOKEN`，点击“检查 MCP 连接”读取两个服务的工具列表，再从列表中选择工具名称和参数。

## GitHub 与 Vercel

仓库应设为 Private。推送后在 Vercel 中使用 Import Git Repository 导入，并把 `.env.example` 中的变量配置到 Production；敏感变量不要暴露为 `NEXT_PUBLIC_*`。

建议部署前执行：

```bash
npm test
npm run lint
npm run build
```

首版使用手动触发，不配置 Cron。单次任务应保持为小批量，避免超过 Vercel Function 时限。
