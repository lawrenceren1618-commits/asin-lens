import type { CommerceRatesConfig } from "./commerce-rates";
import { DEFAULT_COMMERCE_RATES } from "./commerce-rates";

export type PackParseResult = {
  packCount: number;
  packCountSource: "title" | "assumed_one";
};

export type MetricAvail =
  | { status: "ok"; value: number }
  | { status: "no_result"; reason: string };

export type UnitEconomics = {
  rootCategory: string | null;
  packCount: number;
  packCountSource: "title" | "assumed_one";
  listingPrice: number | null;
  unitAvgPrice: number | null;
  deliveryPrice: MetricAvail;
  unitAvgDelivery: MetricAvail;
  fbaFee: MetricAvail;
  unitFbaFee: MetricAvail;
  referralRate: number;
  unitReferralFee: MetricAvail;
  billableWeightKg: number | null;
  firstMileMode: CommerceRatesConfig["firstMileMode"];
  firstMileRateCnyPerKg: number;
  firstMileUnitCostCny: MetricAvail;
  firstMileUnitCostUsd: MetricAvail;
  unitProfitProxyUsd: MetricAvail;
};

const PACK_PATTERNS: RegExp[] = [
  /\b(\d+)\s*[- ]?\s*packs?\b/i,
  /\bpack\s*of\s*(\d+)\b/i,
  /\b(\d+)\s*[- ]?\s*pcs\b/i,
  /\b(\d+)\s*[- ]?\s*pieces?\b/i,
  /\b(\d+)\s*[- ]?\s*count\b/i,
  /(\d+)\s*件/,
  /(\d+)\s*装/,
];

export function parsePackCountFromTitle(title: string | null | undefined): PackParseResult {
  const text = (title ?? "").trim();
  if (!text) {
    return { packCount: 1, packCountSource: "assumed_one" };
  }
  for (const pattern of PACK_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const n = Number(match[1]);
    if (Number.isInteger(n) && n >= 1 && n <= 500) {
      return { packCount: n, packCountSource: "title" };
    }
  }
  return { packCount: 1, packCountSource: "assumed_one" };
}

export function parseRootCategory(
  bsrLabel: unknown,
  nodeLabelPath: unknown,
): string | null {
  if (typeof bsrLabel === "string" && bsrLabel.trim()) {
    return bsrLabel.trim();
  }
  if (typeof nodeLabelPath === "string" && nodeLabelPath.trim()) {
    const first = nodeLabelPath.split(":")[0]?.trim();
    return first || null;
  }
  return null;
}

/** 解析 "15.2 ounces" / "8.88 pounds" / 纯数字（无单位且 >1000 当作克，否则 kg） */
export function parseWeightToKg(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    // keepa 偶发无单位大数；>1000 当作克
    if (raw > 1000) return raw / 1000;
    return raw;
  }
  if (typeof raw !== "string") return null;
  const text = raw.trim().toLowerCase();
  if (!text) return null;
  const match = text.match(
    /([\d.]+)\s*(kg|kilogram|g|gram|oz|ounce|lb|pound)?s?\b/,
  );
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = match[2];
  if (!unit) {
    // keepa weight 示例 "1063280"：无单位大数按克
    if (n > 1000) return n / 1000;
    return n;
  }
  if (unit.startsWith("kg") || unit.startsWith("kilogram")) return n;
  if (unit === "g" || unit.startsWith("gram")) return n / 1000;
  if (unit.startsWith("oz") || unit.startsWith("ounce")) return n * 0.0283495;
  if (unit.startsWith("lb") || unit.startsWith("pound")) return n * 0.453592;
  return n;
}

/** 英寸尺寸 → 计费体积重 kg（除数 139，美西常见国内件近似） */
export function dimensionalWeightKgFromInches(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const parts = raw.toLowerCase().match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)/);
  if (!parts) return null;
  const l = Number(parts[1]);
  const w = Number(parts[2]);
  const h = Number(parts[3]);
  if (![l, w, h].every((n) => Number.isFinite(n) && n > 0)) return null;
  const lb = (l * w * h) / 139;
  return lb * 0.453592;
}

export function resolveBillableWeightKg(input: {
  weight?: unknown;
  pkgWeight?: unknown;
  pkgWeightGram?: unknown;
  dimensions?: unknown;
  pkgDimensions?: unknown;
}): number | null {
  const candidates: number[] = [];
  const w1 = parseWeightToKg(input.weight);
  const w2 = parseWeightToKg(input.pkgWeight);
  if (typeof input.pkgWeightGram === "number" && input.pkgWeightGram > 0) {
    candidates.push(input.pkgWeightGram / 1000);
  }
  if (w1 !== null) candidates.push(w1);
  if (w2 !== null) candidates.push(w2);
  const d1 = dimensionalWeightKgFromInches(input.dimensions);
  const d2 = dimensionalWeightKgFromInches(input.pkgDimensions);
  if (d1 !== null) candidates.push(d1);
  if (d2 !== null) candidates.push(d2);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function ok(value: number): MetricAvail {
  return { status: "ok", value: round4(value) };
}

function noResult(reason: string): MetricAvail {
  return { status: "no_result", reason };
}

export type ListingExtras = {
  deliveryPrice: number | null;
  weight: string | null;
  pkgWeight: string | null;
  pkgWeightGram: number | null;
  dimensions: string | null;
  pkgDimensions: string | null;
  bsrLabel: string | null;
  nodeLabelPath: string | null;
  fulfillment: string | null;
  fbaFees: number | null;
};

export function emptyListingExtras(): ListingExtras {
  return {
    deliveryPrice: null,
    weight: null,
    pkgWeight: null,
    pkgWeightGram: null,
    dimensions: null,
    pkgDimensions: null,
    bsrLabel: null,
    nodeLabelPath: null,
    fulfillment: null,
    fbaFees: null,
  };
}

export function computeUnitEconomics(input: {
  title: string | null;
  listingPrice: number | null;
  extras: ListingExtras;
  rates?: CommerceRatesConfig;
}): UnitEconomics {
  const rates = input.rates ?? DEFAULT_COMMERCE_RATES;
  const pack = parsePackCountFromTitle(input.title);
  const rootCategory = parseRootCategory(
    input.extras.bsrLabel,
    input.extras.nodeLabelPath,
  );
  const listingPrice = input.listingPrice;
  const unitAvgPrice =
    listingPrice !== null && pack.packCount > 0
      ? round4(listingPrice / pack.packCount)
      : null;

  let deliveryPrice: MetricAvail = noResult("无卖家运费");
  if (
    input.extras.deliveryPrice !== null &&
    input.extras.deliveryPrice >= 0
  ) {
    deliveryPrice = ok(input.extras.deliveryPrice);
  }

  const unitAvgDelivery: MetricAvail =
    deliveryPrice.status === "ok"
      ? ok(deliveryPrice.value / pack.packCount)
      : noResult(deliveryPrice.reason);

  let fbaFee: MetricAvail = noResult("无 FBA 费用（需 keepa_info）");
  if (input.extras.fbaFees !== null && input.extras.fbaFees >= 0) {
    fbaFee = ok(input.extras.fbaFees);
  }
  const unitFbaFee: MetricAvail =
    fbaFee.status === "ok"
      ? ok(fbaFee.value / pack.packCount)
      : noResult(fbaFee.reason);

  const referralRate = rates.commissionRate;
  const unitReferralFee: MetricAvail =
    unitAvgPrice !== null
      ? ok(unitAvgPrice * referralRate)
      : noResult("缺少售价，无法算佣金");

  const billableWeightKg = resolveBillableWeightKg({
    weight: input.extras.weight,
    pkgWeight: input.extras.pkgWeight,
    pkgWeightGram: input.extras.pkgWeightGram,
    dimensions: input.extras.dimensions,
    pkgDimensions: input.extras.pkgDimensions,
  });

  const mode = rates.firstMileMode;
  const firstMileRateCnyPerKg = rates.firstMileRatesCnyPerKg[mode];
  let firstMileUnitCostCny: MetricAvail = noResult("缺少计费重量");
  let firstMileUnitCostUsd: MetricAvail = noResult("缺少计费重量");
  if (billableWeightKg !== null && billableWeightKg > 0) {
    const totalCny = billableWeightKg * firstMileRateCnyPerKg;
    const unitCny = totalCny / pack.packCount;
    firstMileUnitCostCny = ok(unitCny);
    firstMileUnitCostUsd = ok(unitCny / rates.fxCnyPerUsd);
  }

  let unitProfitProxyUsd: MetricAvail = noResult("缺少单个平均售价");
  if (unitAvgPrice !== null) {
    let profit = unitAvgPrice;
    const parts: string[] = [];
    if (unitReferralFee.status === "ok") {
      profit -= unitReferralFee.value;
    } else {
      parts.push("佣金缺");
    }
    if (unitAvgDelivery.status === "ok") {
      profit -= unitAvgDelivery.value;
    } else {
      parts.push("配送缺");
    }
    if (unitFbaFee.status === "ok") {
      profit -= unitFbaFee.value;
    } else {
      parts.push("FBA缺");
    }
    if (firstMileUnitCostUsd.status === "ok") {
      profit -= firstMileUnitCostUsd.value;
    } else {
      parts.push("头程缺");
    }
    unitProfitProxyUsd = {
      status: "ok",
      value: round4(profit),
    };
    if (parts.length > 0) {
      // still ok but reason encoded via noting in UI; keep ok with value
      void parts;
    }
  }

  return {
    rootCategory,
    packCount: pack.packCount,
    packCountSource: pack.packCountSource,
    listingPrice,
    unitAvgPrice,
    deliveryPrice,
    unitAvgDelivery,
    fbaFee,
    unitFbaFee,
    referralRate,
    unitReferralFee,
    billableWeightKg:
      billableWeightKg === null ? null : round4(billableWeightKg),
    firstMileMode: mode,
    firstMileRateCnyPerKg,
    firstMileUnitCostCny,
    firstMileUnitCostUsd,
    unitProfitProxyUsd,
  };
}
