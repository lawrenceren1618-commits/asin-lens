/** 头程运输方式（费率用户可配；默认均为 6 CNY/kg） */
export const FIRST_MILE_MODES = [
  "air",
  "sea_regular_truck",
  "sea_express_truck",
  "sea_express_delivery",
  "full_express",
] as const;

export type FirstMileMode = (typeof FIRST_MILE_MODES)[number];

export const FIRST_MILE_MODE_LABEL: Record<FirstMileMode, string> = {
  air: "空运",
  sea_regular_truck: "海运普船卡派",
  sea_express_truck: "海运快船卡派",
  sea_express_delivery: "海运快递派送",
  full_express: "全程快递派送",
};

export type CommerceRatesConfig = {
  /** 佣金占售价比例，默认 0.15；后续可按大类表覆盖 */
  commissionRate: number;
  firstMileMode: FirstMileMode;
  /** 各头程模式单价：CNY / kg */
  firstMileRatesCnyPerKg: Record<FirstMileMode, number>;
  /** 头程 CNY → 售价币种（USD）粗换算，仅用于利润代理 */
  fxCnyPerUsd: number;
};

export const DEFAULT_COMMERCE_RATES: CommerceRatesConfig = {
  commissionRate: 0.15,
  firstMileMode: "air",
  firstMileRatesCnyPerKg: {
    air: 6,
    sea_regular_truck: 6,
    sea_express_truck: 6,
    sea_express_delivery: 6,
    full_express: 6,
  },
  fxCnyPerUsd: 7.2,
};

export function parseCommerceRates(input: unknown): CommerceRatesConfig {
  const base = DEFAULT_COMMERCE_RATES;
  if (!input || typeof input !== "object") return { ...base, firstMileRatesCnyPerKg: { ...base.firstMileRatesCnyPerKg } };

  const raw = input as Record<string, unknown>;
  const commissionRate =
    typeof raw.commissionRate === "number" &&
    Number.isFinite(raw.commissionRate) &&
    raw.commissionRate >= 0 &&
    raw.commissionRate <= 1
      ? raw.commissionRate
      : base.commissionRate;

  const firstMileMode = FIRST_MILE_MODES.includes(
    raw.firstMileMode as FirstMileMode,
  )
    ? (raw.firstMileMode as FirstMileMode)
    : base.firstMileMode;

  const ratesIn =
    raw.firstMileRatesCnyPerKg &&
    typeof raw.firstMileRatesCnyPerKg === "object"
      ? (raw.firstMileRatesCnyPerKg as Record<string, unknown>)
      : {};
  const firstMileRatesCnyPerKg = { ...base.firstMileRatesCnyPerKg };
  for (const mode of FIRST_MILE_MODES) {
    const n = ratesIn[mode];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) {
      firstMileRatesCnyPerKg[mode] = n;
    }
  }

  const fxCnyPerUsd =
    typeof raw.fxCnyPerUsd === "number" &&
    Number.isFinite(raw.fxCnyPerUsd) &&
    raw.fxCnyPerUsd > 0
      ? raw.fxCnyPerUsd
      : base.fxCnyPerUsd;

  return {
    commissionRate,
    firstMileMode,
    firstMileRatesCnyPerKg,
    fxCnyPerUsd,
  };
}
