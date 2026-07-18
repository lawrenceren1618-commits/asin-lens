import { createHash } from "node:crypto";

export type SourceResult = {
  source: "SellerSprite" | "Sif";
  tool: string;
  raw: unknown;
};

export type NormalizedItem = {
  source: SourceResult["source"];
  tool: string;
  data: Record<string, unknown>;
  rawSummary: string;
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safeJson(value: unknown, maxLength = 90_000) {
  const json = JSON.stringify(value, null, 2) ?? "";
  return json.length > maxLength
    ? `${json.slice(0, maxLength)}\n...[truncated]`
    : json;
}

function parseText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function resultPayload(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  if (raw.structuredContent !== undefined) return raw.structuredContent;

  const content = raw.content;
  if (Array.isArray(content)) {
    const values = content
      .filter(isObject)
      .map((item) =>
        item.type === "text" && typeof item.text === "string"
          ? parseText(item.text)
          : item,
      );
    return values.length === 1 ? values[0] : values;
  }
  return raw;
}

function findItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload)) return [payload];

  for (const key of ["items", "data", "results", "records", "list"]) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [payload];
}

export function normalizeToolResult(result: SourceResult): NormalizedItem[] {
  const payload = resultPayload(result.raw);
  return findItems(payload).map((item) => ({
    source: result.source,
    tool: result.tool,
    data: isObject(item) ? item : { value: item },
    rawSummary: safeJson(item, 8_000),
  }));
}

export function firstText(
  item: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return "";
}

export function stableKey(
  item: NormalizedItem,
  day: string,
  market: string,
) {
  const identity =
    firstText(item.data, [
      "asin",
      "ASIN",
      "keyword",
      "关键词",
      "id",
      "productId",
      "title",
    ]) || safeJson(item.data);
  return createHash("sha256")
    .update([item.source, item.tool, market, day, identity].join("|"))
    .digest("hex");
}
