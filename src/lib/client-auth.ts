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
  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new ApiError(
      data.error ?? `请求失败 (${response.status})`,
      response.status,
      data,
    );
  }
  return data;
}
