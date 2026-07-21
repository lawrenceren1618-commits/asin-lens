"use client";

const TOKEN_KEY = "asin-lens-admin-token";

export function getAdminToken() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(TOKEN_KEY) ?? "";
}

export function setAdminToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch(path: string, init?: RequestInit) {
  const token = getAdminToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "content-type": "application/json" }),
      "x-admin-token": token,
      ...init?.headers,
    },
  });

  const raw = await response.text();
  let data: { error?: string; failures?: unknown } = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw) as { error?: string; failures?: unknown };
    } catch {
      throw new ApiError(
        `服务器返回了非 JSON（HTTP ${response.status}）${raw.slice(0, 120)}`,
        response.status,
        raw,
      );
    }
  } else if (!response.ok) {
    const hint =
      response.status === 401
        ? "未登录或令牌无效，请先在顶栏粘贴 ADMIN_TOKEN 登录"
        : response.status >= 500
          ? "服务端异常或数据库连不上（检查 DATABASE_URL 是否用 pooler）"
          : `请求失败 (HTTP ${response.status})`;
    throw new ApiError(hint, response.status, null);
  }

  if (!response.ok) {
    throw new ApiError(
      data.error ??
        (response.status === 401
          ? "未登录或令牌无效，请先在顶栏粘贴 ADMIN_TOKEN 登录"
          : `请求失败 (${response.status})`),
      response.status,
      data,
    );
  }
  return data;
}
