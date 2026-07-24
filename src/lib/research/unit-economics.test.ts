import { describe, expect, it } from "vitest";

import {
  DEFAULT_COMMERCE_RATES,
  type CommerceRatesConfig,
} from "./commerce-rates";
import {
  computeUnitEconomics,
  emptyListingExtras,
  parsePackCountFromTitle,
  parseRootCategory,
  parseWeightToKg,
  resolveBillableWeightKg,
} from "./unit-economics";

describe("parsePackCountFromTitle", () => {
  it("parses N Pack / pack of N / count", () => {
    expect(parsePackCountFromTitle("White Table Cloth 10 Pack Rectangle")).toEqual({
      packCount: 10,
      packCountSource: "title",
    });
    expect(parsePackCountFromTitle("WIGENIUS 6 Pack White Table Cloth")).toEqual({
      packCount: 6,
      packCountSource: "title",
    });
    expect(parsePackCountFromTitle("Pack of 12 Disposable Cloths")).toEqual({
      packCount: 12,
      packCountSource: "title",
    });
    expect(parsePackCountFromTitle("Table Cover 24 Count")).toEqual({
      packCount: 24,
      packCountSource: "title",
    });
  });

  it("assumes one when missing or out of range", () => {
    expect(parsePackCountFromTitle("Single cloth")).toEqual({
      packCount: 1,
      packCountSource: "assumed_one",
    });
    expect(parsePackCountFromTitle("")).toEqual({
      packCount: 1,
      packCountSource: "assumed_one",
    });
    expect(parsePackCountFromTitle("501 Pack Impossible")).toEqual({
      packCount: 1,
      packCountSource: "assumed_one",
    });
  });
});

describe("computeUnitEconomics", () => {
  const baseExtras = {
    ...emptyListingExtras(),
    weight: "2 pounds",
    bsrLabel: "Home & Kitchen",
    nodeLabelPath: "Home & Kitchen:Kitchen:Tablecloths",
    fulfillment: "FBA",
    fbaFees: 5,
  };

  it("computes unit avg price and 15% referral", () => {
    const econ = computeUnitEconomics({
      title: "FINDYOU 10 Pack White Table Cloth",
      listingPrice: 39.5,
      extras: baseExtras,
    });
    expect(econ.packCount).toBe(10);
    expect(econ.unitAvgPrice).toBe(3.95);
    expect(econ.rootCategory).toBe("Home & Kitchen");
    expect(econ.referralRate).toBe(0.15);
    expect(econ.unitReferralFee.status).toBe("ok");
    if (econ.unitReferralFee.status === "ok") {
      expect(econ.unitReferralFee.value).toBeCloseTo(3.95 * 0.15, 4);
    }
    expect(econ.unitFbaFee.status).toBe("ok");
    expect(econ.firstMileUnitCostCny.status).toBe("ok");
  });

  it("marks FBA and first-mile no_result when missing; profit still ok with 缺项未扣", () => {
    const econ = computeUnitEconomics({
      title: "Cloth 4 Pack",
      listingPrice: 20,
      extras: emptyListingExtras(),
    });
    expect(econ.unitAvgPrice).toBe(5);
    expect(econ.unitFbaFee.status).toBe("no_result");
    expect(econ.unitAvgDelivery.status).toBe("no_result");
    expect(econ.firstMileUnitCostUsd.status).toBe("no_result");
    expect(econ.unitReferralFee.status).toBe("ok");
    expect(econ.unitProfitProxyUsd.status).toBe("ok");
    if (econ.unitProfitProxyUsd.status === "ok") {
      // 仅扣佣金 5*0.15；配送/FBA/头程缺项未扣
      expect(econ.unitProfitProxyUsd.value).toBeCloseTo(5 - 5 * 0.15, 4);
    }
  });

  it("uses firstMileMode rate from commerce config", () => {
    const rates: CommerceRatesConfig = {
      ...DEFAULT_COMMERCE_RATES,
      firstMileMode: "sea_express_truck",
      firstMileRatesCnyPerKg: {
        ...DEFAULT_COMMERCE_RATES.firstMileRatesCnyPerKg,
        sea_express_truck: 12,
      },
      fxCnyPerUsd: 7.2,
    };
    const econ = computeUnitEconomics({
      title: "One piece",
      listingPrice: 10,
      extras: {
        ...emptyListingExtras(),
        pkgWeightGram: 1000,
      },
      rates,
    });
    expect(econ.firstMileMode).toBe("sea_express_truck");
    expect(econ.firstMileRateCnyPerKg).toBe(12);
    expect(econ.firstMileUnitCostCny.status).toBe("ok");
    if (econ.firstMileUnitCostCny.status === "ok") {
      expect(econ.firstMileUnitCostCny.value).toBe(12);
    }
    expect(econ.firstMileUnitCostUsd.status).toBe("ok");
    if (econ.firstMileUnitCostUsd.status === "ok") {
      expect(econ.firstMileUnitCostUsd.value).toBeCloseTo(12 / 7.2, 4);
    }
  });

  it("returns no_result profit when listing price missing", () => {
    const econ = computeUnitEconomics({
      title: "10 Pack",
      listingPrice: null,
      extras: baseExtras,
    });
    expect(econ.unitAvgPrice).toBeNull();
    expect(econ.unitProfitProxyUsd.status).toBe("no_result");
  });
});

describe("helpers", () => {
  it("parses weight with units and bare keepa gram strings", () => {
    expect(parseWeightToKg("15.2 ounces")).toBeCloseTo(0.4309, 3);
    expect(parseWeightToKg("2 pounds")).toBeCloseTo(0.9072, 3);
    expect(parseWeightToKg("1063280")).toBeCloseTo(1063.28, 2);
    expect(parseWeightToKg(13660)).toBeCloseTo(13.66, 2);
  });

  it("parses root category from bsrLabel or node path", () => {
    expect(parseRootCategory("Home & Kitchen", null)).toBe("Home & Kitchen");
    expect(parseRootCategory(null, "Home & Kitchen:Bedding")).toBe(
      "Home & Kitchen",
    );
  });

  it("resolves billable weight preferring max of candidates", () => {
    const kg = resolveBillableWeightKg({
      pkgWeightGram: 500,
      pkgDimensions: "10 x 10 x 10 inches",
    });
    expect(kg).not.toBeNull();
    // dim: 1000/139 lb ≈ 3.26 kg > 0.5 kg
    expect(kg!).toBeGreaterThan(0.5);
  });
});
