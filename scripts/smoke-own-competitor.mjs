/**
 * Smoke test: MCP → clean → industry/opt markdown (no DB).
 * Usage: npx tsx scripts/smoke-own-competitor.mjs
 */
import { config } from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

config({ path: ".env.local" });

const OWN = "B0CCRKDW1K";
const COMPETITOR = "B0CBF4T1V3";
const MARKET = "US";

async function callTool(baseUrl, secret, extraHeaders, tool, args) {
  const url = new URL(baseUrl);
  url.searchParams.set("secret-key", secret);
  const headers = { ...extraHeaders };
  const client = new Client({ name: "asin-lens-smoke", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers },
  });
  try {
    await client.connect(transport);
    return await client.callTool({ name: tool, arguments: args });
  } finally {
    await client.close().catch(() => undefined);
  }
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
  const { normalizeToolResult, safeJson } = await import(
    "../src/lib/research/normalize.ts"
  );

  const ssUrl =
    process.env.SELLERSPRITE_MCP_URL ?? "https://mcp.sellersprite.com/mcp";
  const ssKey = process.env.SELLERSPRITE_SECRET_KEY;
  const sifUrl = process.env.SIF_MCP_URL ?? "https://mcp.sif.com/mcp";
  const sifKey = process.env.SIF_SECRET_KEY;
  const sifHeader = process.env.SIF_AUTH_HEADER ?? "secret-key";
  const sifScheme = process.env.SIF_AUTH_SCHEME ?? "";

  if (!ssKey && !sifKey) {
    throw new Error("Missing SELLERSPRITE_SECRET_KEY / SIF_SECRET_KEY");
  }

  async function fetchSources(asin) {
    const sources = [];
    if (ssKey) {
      try {
        const raw = await callTool(ssUrl, ssKey, {}, "asin_detail", {
          asin,
          marketplace: MARKET,
        });
        sources.push({ source: "SellerSprite", tool: "asin_detail", raw });
        const items = normalizeToolResult(sources[0]);
        console.log(
          `${asin} SS keys:`,
          items.flatMap((i) => Object.keys(i.data)).slice(0, 20).join(", ") ||
            "(none)",
        );
      } catch (error) {
        console.log(
          `${asin} SS FAIL:`,
          error instanceof Error ? error.message.slice(0, 180) : error,
        );
        sources.push({
          source: "SellerSprite",
          tool: "asin_detail",
          raw: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
    if (sifKey) {
      try {
        const raw = await callTool(
          sifUrl,
          sifKey,
          { [sifHeader]: `${sifScheme}${sifKey}` },
          "asin_detail",
          { asin, marketplace: MARKET },
        );
        sources.push({ source: "Sif", tool: "asin_detail", raw });
        const items = normalizeToolResult(sources.at(-1));
        console.log(
          `${asin} Sif keys:`,
          items.flatMap((i) => Object.keys(i.data)).slice(0, 20).join(", ") ||
            "(none)",
        );
        console.log(`${asin} Sif preview:`, safeJson(raw, 450));
      } catch (error) {
        console.log(
          `${asin} Sif FAIL:`,
          error instanceof Error ? error.message.slice(0, 180) : error,
        );
      }
    }
    return sources;
  }

  console.log(`OWN=${OWN} COMPETITOR=${COMPETITOR}`);
  const ownSources = await fetchSources(OWN);
  const compSources = await fetchSources(COMPETITOR);

  function tryClean(label, sources) {
    try {
      const { metrics } = prepareMetricsForStorage(sources);
      console.log(
        `${label} OK title="${metrics.title.slice(0, 48)}" price=${metrics.price} kw=${metrics.keywordTraffic.length}`,
      );
      return metrics;
    } catch (error) {
      console.log(
        `${label} CLEAN FAIL:`,
        error instanceof Error ? error.message : error,
      );
      return null;
    }
  }

  const ownMetrics = tryClean("OWN", ownSources);
  const compMetrics = tryClean("COMP", compSources);

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

  const { markdown, verify } = prepareIndustryOptExport({
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
            ? "这是分散型流量。"
            : own.trafficPattern === "concentrated"
              ? "集中型流量。"
              : "流量结构未知。",
        pricingNote:
          own.price !== null && competitor.price !== null
            ? `我方 ${own.price} vs 竞品 ${competitor.price}`
            : "价格样本不足",
        copyNote: `我方标题长度 ${(own.title || "").length}；竞品 ${(competitor.title || "").length}`,
        keywordInsights: own.topKeywords,
      },
    ],
  });

  console.log("verify.ok=", verify.ok);
  console.log("----- REPORT -----");
  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
