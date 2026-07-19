import { config } from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

config({ path: ".env.local" });

async function list(name, base, secret, headers = {}) {
  const url = new URL(base);
  url.searchParams.set("secret-key", secret);
  const client = new Client({ name: "list-tools", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers },
  });
  await client.connect(transport);
  const tools = await client.listTools();
  console.log(
    name,
    tools.tools.map((t) => t.name).join(" | ") || "(none)",
  );
  await client.close().catch(() => undefined);
}

const ss = process.env.SELLERSPRITE_SECRET_KEY;
const sif = process.env.SIF_SECRET_KEY;
if (ss) {
  await list(
    "SellerSprite",
    process.env.SELLERSPRITE_MCP_URL || "https://mcp.sellersprite.com/mcp",
    ss,
  );
}
if (sif) {
  const header = process.env.SIF_AUTH_HEADER || "secret-key";
  const scheme = process.env.SIF_AUTH_SCHEME || "";
  await list(
    "Sif",
    process.env.SIF_MCP_URL || "https://mcp.sif.com/mcp",
    sif,
    { [header]: `${scheme}${sif}` },
  );
}
