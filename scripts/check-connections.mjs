import { readFile } from "node:fs/promises";
import process from "node:process";

const ENV_FILE = new URL("../.env.local", import.meta.url);
const TIMEOUT_MS = 20_000;

function parseEnv(text) {
  const values = {};
  const errors = [];

  for (const [index, rawLine] of text.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator < 1) {
      errors.push(`第 ${index + 1} 行缺少“变量名=”格式`);
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return { values, errors };
}

function required(values, name) {
  const value = values[name];
  if (!value) throw new Error(`${name} 未填写`);
  if (/^(你的密钥|your[_ -]?secret|replace|todo|xxx)/iu.test(value)) {
    throw new Error(`${name} 仍是占位值`);
  }
  return value;
}

function safeUrl(values, name, fallback) {
  const url = new URL(values[name] || fallback);
  if (url.protocol !== "https:") throw new Error(`${name} 必须使用 HTTPS`);
  if (url.search) {
    throw new Error(
      `${name} 不能包含查询参数；请把密钥放入独立的 SECRET_KEY 变量`,
    );
  }
  return url;
}

function withSecretQuery(url, secret) {
  const authenticatedUrl = new URL(url);
  authenticatedUrl.searchParams.set("secret-key", secret);
  return authenticatedUrl;
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseMcpResponse(response) {
  const text = await response.text();
  if (!text.trim()) return {};
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const dataLine = text
      .split(/\r?\n/u)
      .find((line) => line.startsWith("data:"));
    if (!dataLine) throw new Error("MCP 返回了 SSE，但没有 data 事件");
    return JSON.parse(dataLine.slice(5).trim());
  }
  return JSON.parse(text);
}

async function mcpRequest(url, headers, body, sessionId) {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...headers,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return {
    payload: await parseMcpResponse(response),
    sessionId: response.headers.get("mcp-session-id") || sessionId,
  };
}

async function checkMcp(name, url, headers) {
  const initialized = await mcpRequest(url, headers, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "connection-check", version: "1.0.0" },
    },
  });
  if (initialized.payload.error) {
    throw new Error(
      `initialize 失败：${initialized.payload.error.message || "未知错误"}`,
    );
  }

  await mcpRequest(
    url,
    headers,
    {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    },
    initialized.sessionId,
  );
  const tools = await mcpRequest(
    url,
    headers,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    },
    initialized.sessionId,
  );
  if (tools.payload.error) {
    throw new Error(
      `tools/list 失败：${tools.payload.error.message || "未知错误"}`,
    );
  }
  const count = Array.isArray(tools.payload.result?.tools)
    ? tools.payload.result.tools.length
    : 0;
  return `${name} 已连接，可见工具 ${count} 个`;
}

async function checkFeishu(values) {
  const tokenResponse = await fetchWithTimeout(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        app_id: required(values, "FEISHU_APP_ID"),
        app_secret: required(values, "FEISHU_APP_SECRET"),
      }),
    },
  );
  const tokenPayload = await tokenResponse.json();
  if (
    !tokenResponse.ok ||
    tokenPayload.code !== 0 ||
    !tokenPayload.tenant_access_token
  ) {
    throw new Error(
      `飞书认证失败 (${tokenPayload.code ?? tokenResponse.status})：${
        tokenPayload.msg || tokenResponse.statusText
      }`,
    );
  }

  const appToken = required(values, "FEISHU_BITABLE_APP_TOKEN");
  const tableResponse = await fetchWithTimeout(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(
      appToken,
    )}/tables?page_size=1`,
    {
      headers: {
        authorization: `Bearer ${tokenPayload.tenant_access_token}`,
      },
    },
  );
  const tablePayload = await tableResponse.json();
  if (!tableResponse.ok || tablePayload.code !== 0) {
    throw new Error(
      `多维表格访问失败 (${tablePayload.code ?? tableResponse.status})：${
        tablePayload.msg || tableResponse.statusText
      }`,
    );
  }
  return "飞书认证与多维表格读取均成功";
}

async function report(name, operation) {
  try {
    const message = await operation();
    console.log(`PASS  ${message}`);
    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? `连接超时（${TIMEOUT_MS / 1000} 秒）`
          : error.message
        : String(error);
    console.error(`FAIL  ${name}：${message}`);
    return false;
  }
}

async function main() {
  const { values, errors } = parseEnv(await readFile(ENV_FILE, "utf8"));
  if (errors.length) {
    for (const error of errors) console.error(`FAIL  环境文件：${error}`);
    process.exitCode = 1;
    return;
  }

  const sellerUrl = safeUrl(
    values,
    "SELLERSPRITE_MCP_URL",
    "https://mcp.sellersprite.com/mcp",
  );
  const sifUrl = safeUrl(
    values,
    "SIF_MCP_URL",
    "https://mcp.sif.com/mcp",
  );
  const sifHeader = values.SIF_AUTH_HEADER || "secret-key";
  const sifScheme = values.SIF_AUTH_SCHEME || "";
  const sellerSecret = required(values, "SELLERSPRITE_SECRET_KEY");
  const sifSecret = required(values, "SIF_SECRET_KEY");

  const checks = await Promise.all([
    report("SellerSprite MCP", () =>
      checkMcp(
        "SellerSprite MCP",
        withSecretQuery(sellerUrl, sellerSecret),
        {},
      ),
    ),
    report("Sif MCP", () =>
      checkMcp(
        "Sif MCP",
        withSecretQuery(sifUrl, sifSecret),
        { [sifHeader]: `${sifScheme}${sifSecret}` },
      ),
    ),
    report("飞书", () => checkFeishu(values)),
  ]);

  if (checks.some((passed) => !passed)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    `FAIL  检查程序：${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
