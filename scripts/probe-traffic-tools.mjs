import { config } from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

config({ path: ".env.local" });

const ASIN = process.argv[2] || "B0CCRKDW1K";

async function call(base, secret, headers, tool, args) {
  const url = new URL(base);
  url.searchParams.set("secret-key", secret);
  const client = new Client({ name: "probe", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers },
  });
  try {
    await client.connect(transport);
    const raw = await client.callTool({ name: tool, arguments: args });
    const text = JSON.stringify(raw);
    console.log(`\n=== ${tool} ===`);
    console.log(text.slice(0, 900));
  } catch (error) {
    console.log(
      `\n=== ${tool} FAIL ===`,
      error instanceof Error ? error.message.slice(0, 200) : error,
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

const ss = process.env.SELLERSPRITE_SECRET_KEY;
const sif = process.env.SIF_SECRET_KEY;
const ssUrl = process.env.SELLERSPRITE_MCP_URL || "https://mcp.sellersprite.com/mcp";
const sifUrl = process.env.SIF_MCP_URL || "https://mcp.sif.com/mcp";
const sifHeader = process.env.SIF_AUTH_HEADER || "secret-key";
const sifScheme = process.env.SIF_AUTH_SCHEME || "";

if (ss) {
  for (const tool of ["traffic_keyword", "traffic_source", "traffic_keyword_stat"]) {
    await call(ssUrl, ss, {}, tool, { asin: ASIN, marketplace: "US" });
  }
}
if (sif) {
  const headers = { [sifHeader]: `${sifScheme}${sif}` };
  for (const tool of [
    "ops_get_listing_keyword_distribution",
    "ops_get_listing_traffic_structure",
    "market_get_asin_keyword_signals",
    "ops_get_listing_traffic_overview",
  ]) {
    await call(sifUrl, sif, headers, tool, { asin: ASIN, marketplace: "US" });
    await call(sifUrl, sif, headers, tool, { asin: ASIN, market: "US" });
  }
}
