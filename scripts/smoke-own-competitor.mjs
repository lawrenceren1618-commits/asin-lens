/**
 * Smoke test: own vs competitor ASINs via MCP clean → industry/opt report (no DB).
 * Usage: node scripts/smoke-own-competitor.mjs
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const OWN = "B0CCRKDW1K";
const COMPETITOR = "B0CBF4T1V3";
const MARKET = "US";

async function callMcp(baseUrl, secret, tool, args) {
  const url = new URL(baseUrl);
  url.searchParams.set("secret-key", secret);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "secret-key": secret,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${tool} HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  // SSE or JSON
  if (text.includes("data:")) {
    const line = text.split(/\r?\n/).find((l) => l.startsWith("data:"));
    if (!line) return { raw: text.slice(0, 500) };
    return JSON.parse(line.slice(5).trim());
  }
  return JSON.parse(text);
}

async function fetchSources(asin) {
  const sources = [];
  const ssUrl = process.env.SELLERSPRITE_MCP_URL || "https://mcp.sellersprite.com/mcp";
  const ssKey = process.env.SELLERSPRITE_SECRET_KEY;
  const sifUrl = process.env.SIF_MCP_URL || "https://mcp.sif.com/mcp";
  const sifKey = process.env.SIF_SECRET_KEY;

  if (ssKey) {
    try {
      const raw = await callMcp(ssUrl, ssKey, "asin_detail", {
        asin,
        marketplace: MARKET,
      });
      sources.push({ source: "SellerSprite", tool: "asin_detail", raw });
    } catch (error) {
      sources.push({
        source: "SellerSprite",
        tool: "asin_detail",
        raw: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  if (sifKey) {
    try {
      const raw = await callMcp(sifUrl, sifKey, "asin_detail", {
        asin,
        marketplace: MARKET,
      });
      sources.push({ source: "Sif", tool: "asin_detail", raw });
    } catch (error) {
      sources.push({
        source: "Sif",
        tool: "asin_detail",
        raw: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  return sources;
}

async function main() {
  const { prepareMetricsForStorage } = await import(
    "../src/lib/research/metrics.ts"
  );
  const { analyzeKeywordTraffic } = await import(
    "../src/lib/research/keyword-traffic.ts"
  );
  const { prepareIndustryOptExport } = await import(
    "../src/lib/research/industry-opt-format.ts"
  );

  console.log(`OWN=${OWN} COMPETITOR=${COMPETITOR}`);

  const ownSources = await fetchSources(OWN);
  const compSources = await fetchSources(COMPETITOR);

  let ownMetrics;
  let compMetrics;
  try {
    ownMetrics = prepareMetricsForStorage(ownSources).metrics;
    console.log(
      `OWN metrics: title=${ownMetrics.title.slice(0, 40)} keywords=${ownMetrics.keywordTraffic.length}`,
    );
  } catch (error) {
    console.error("OWN clean failed:", error instanceof Error ? error.message : error);
    ownMetrics = null;
  }

  try {
    compMetrics = prepareMetricsForStorage(compSources).metrics;
    console.log(
      `COMP metrics: title=${compMetrics.title.slice(0, 40)} keywords=${compMetrics.keywordTraffic.length}`,
    );
  } catch (error) {
    console.error("COMP clean failed:", error instanceof Error ? error.message : error);
    compMetrics = null;
  }

  function slice(asin, role, metrics) {
    const analysis = analyzeKeywordTraffic(metrics?.keywordTraffic ?? []);
    return {
      asin,
      market: MARKET,
      role,
      title: metrics?.title || null,
      price: metrics?.price ?? null,
      traffic: metrics?.traffic ?? null,
      sales: metrics?.sales ?? null,
      rank: metrics?.rank ?? null,
      trafficPattern: analysis.pattern,
      top3ShareSum: analysis.top3ShareSum,
      topKeywords: analysis.keywords,
    };
  }

  const competitor = slice(COMPETITOR, "competitor", compMetrics);
  const own = slice(OWN, "own", ownMetrics);
  const prices = [competitor.price].filter((p) => p !== null);

  const candidate = {
    projectId: "smoke",
    projectName: "Smoke Own/Competitor",
    reportDate: new Date().toISOString().slice(0, 10),
    mode: "industry_plus_own",
    competitorCount: 1,
    ownCount: 1,
    industry: {
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      priceMedian: prices[0] ?? null,
      dispersedAsinCount: competitor.trafficPattern === "dispersed" ? 1 : 0,
      concentratedAsinCount:
        competitor.trafficPattern === "concentrated" ? 1 : 0,
      competitors: [competitor],
    },
    ownOptimizations: [
      {
        asin: OWN,
        market: MARKET,
        manualCvr60d: null,
        trafficPattern: own.trafficPattern,
        trafficNote:
          own.trafficPattern === "dispersed"
            ? "这是分散型流量。深挖留给其它功能区；本报告仅作筛选结论。"
            : own.trafficPattern === "concentrated"
              ? "集中型流量。优先优化前三词。"
              : "流量结构未知。",
        pricingNote:
          own.price !== null && competitor.price !== null
            ? `我方 ${own.price} vs 竞品 ${competitor.price}`
            : "价格样本不足",
        copyNote: `我方标题长度 ${(own.title || "").length}；竞品 ${(competitor.title || "").length}`,
        keywordInsights: own.topKeywords,
      },
    ],
  };

  const { markdown, verify } = prepareIndustryOptExport(candidate);
  console.log("verify.ok=", verify.ok, "issues=", verify.issues.join("; ") || "(none)");
  console.log("----- REPORT -----");
  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
