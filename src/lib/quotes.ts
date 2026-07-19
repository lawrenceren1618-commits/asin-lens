export type QuotePair = {
  zh: string;
  en: string;
};

/**
 * Ambient lines only — welcome / 花语 / quiet encouragement.
 * Not the product core; must validate before display.
 */
const AMBIENT_LINES: QuotePair[] = [
  { zh: "欢迎回来，今天也慢慢看清楚。", en: "Welcome back. See clearly, one step at a time." },
  { zh: "朝阳在前，路在脚下。", en: "Sunrise ahead. The path is underfoot." },
  { zh: "花开不问归期，只问当下。", en: "Bloom without hurry. Stay with the present." },
  { zh: "记录清楚，脉络自明。", en: "Write it down clearly. The thread reveals itself." },
  { zh: "向阳而生，安静生长。", en: "Grow toward the light, quietly." },
  { zh: "把昨天理清，把今天走稳。", en: "Settle yesterday. Walk today steady." },
  { zh: "一缕晨光，足够出发。", en: "A thread of dawn is enough to begin." },
  { zh: "愿你所记，皆可回溯。", en: "May every note stay traceable." },
];

const ZH_MAX = 40;
const EN_MAX = 80;
const UNSAFE = /[<>{}\\`]|https?:\/\//i;
const HAS_HAN = /[\u4e00-\u9fff]/;
const HAS_LATIN = /[A-Za-z]/;
const EN_ALLOWED = /^[A-Za-z0-9 ,.'!\-—:;?]+$/;

function normalizeText(text: string): string {
  return text
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isSafeZh(text: string): boolean {
  if (!text || text.length > ZH_MAX) return false;
  if (!HAS_HAN.test(text)) return false;
  if (HAS_LATIN.test(text)) return false;
  if (UNSAFE.test(text)) return false;
  return true;
}

function isSafeEn(text: string): boolean {
  if (!text || text.length > EN_MAX) return false;
  if (!HAS_LATIN.test(text)) return false;
  if (UNSAFE.test(text)) return false;
  if (!EN_ALLOWED.test(text)) return false;
  return true;
}

/** Verify before display — fail closed. */
export function validateQuotePair(pair: unknown): QuotePair | null {
  if (!pair || typeof pair !== "object") return null;
  const candidate = pair as Partial<QuotePair>;
  if (typeof candidate.zh !== "string" || typeof candidate.en !== "string") return null;

  const zh = normalizeText(candidate.zh);
  const en = normalizeText(candidate.en);

  if (!isSafeZh(zh) || !isSafeEn(en)) return null;
  return { zh, en };
}

function curatedSafePairs(): QuotePair[] {
  return AMBIENT_LINES.map(validateQuotePair).filter((p): p is QuotePair => p !== null);
}

/** Pick one ambient line only after mount. */
export function pickSafeQuotePair(seed = Date.now()): QuotePair | null {
  const safe = curatedSafePairs();
  if (safe.length === 0) return null;
  const index = Math.abs(seed) % safe.length;
  return safe[index] ?? null;
}
