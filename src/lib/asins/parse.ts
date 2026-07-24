/** Amazon ASIN：10 位大写字母数字，如 B0CBF6C9FF */

export const ASIN_RE = /^[A-Z0-9]{10}$/;

export function normalizeAsinCandidate(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-_]/g, "");
}

export function isValidAsin(value: string): boolean {
  return ASIN_RE.test(normalizeAsinCandidate(value));
}

export type ExtractAsinResult =
  | { ok: true; asin: string }
  | { ok: false; error: string };

export type ExtractAsinsResult =
  | { ok: true; asins: string[] }
  | { ok: false; error: string };

function collectAsinCandidates(text: string): string[] {
  const hits: { index: number; asin: string }[] = [];
  const add = (index: number, asin: string) => {
    const upper = asin.toUpperCase();
    if (!ASIN_RE.test(upper)) return;
    if (hits.some((hit) => hit.asin === upper)) return;
    hits.push({ index, asin: upper });
  };

  for (const match of text.matchAll(
    /(?:\/dp\/|\/gp\/product\/|\/product\/|[?&]asin=)([A-Za-z0-9]{10})\b/gi,
  )) {
    if (match.index != null) add(match.index, match[1]);
  }

  for (const match of text.toUpperCase().matchAll(/\b(B0[A-Z0-9]{8})\b/g)) {
    if (match.index != null) add(match.index, match[1]);
  }

  for (const match of text.toUpperCase().matchAll(/\b([A-Z0-9]{10})\b/g)) {
    // 排除纯字母词（如 COMPETITOR）；真 ASIN 至少含一位数字
    if (match.index != null && /[0-9]/.test(match[1])) {
      add(match.index, match[1]);
    }
  }

  const compact = normalizeAsinCandidate(text);
  if (ASIN_RE.test(compact) && hits.length === 0) {
    add(0, compact);
  }

  hits.sort((a, b) => a.index - b.index);
  return hits.map((hit) => hit.asin);
}

/**
 * 从纯 ASIN、粘贴文本或亚马逊商品链接中识别 **一个** ASIN。
 * 若识别到多个，返回第一个；需要全部列表时用 `extractAsins`。
 */
export function extractAsin(input: string): ExtractAsinResult {
  const multi = extractAsins(input);
  if (!multi.ok) return multi;
  return { ok: true, asin: multi.asins[0] };
}

/**
 * 识别粘贴内容中的全部合法 ASIN（去重、按出现顺序）。
 * 格式全不对时返回错误，调用方不得继续 MCP。
 */
export function extractAsins(input: string): ExtractAsinsResult {
  const text = input.trim();
  if (!text) {
    return { ok: false, error: "请粘贴或输入 ASIN（如 B0CBF6C9FF）" };
  }

  const asins = collectAsinCandidates(text);
  if (asins.length === 0) {
    return {
      ok: false,
      error:
        "ASIN 格式有误。应为 10 位字母数字（如 B0CBF6C9FF），也可粘贴含 /dp/ASIN 的亚马逊链接。未调用采集。",
    };
  }
  return { ok: true, asins };
}
