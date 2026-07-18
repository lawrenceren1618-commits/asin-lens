import "server-only";

import { callRemoteTool, listRemoteTools } from "./client";

function config() {
  const secret = process.env.SELLERSPRITE_SECRET_KEY;
  if (!secret) {
    throw new Error("SELLERSPRITE_SECRET_KEY is not configured");
  }
  const url = new URL(
    process.env.SELLERSPRITE_MCP_URL ??
      "https://mcp.sellersprite.com/mcp",
  );
  url.searchParams.set("secret-key", secret);

  return {
    name: "amazon-user-research-sellersprite",
    version: "0.1.0",
    url: url.toString(),
    headers: {},
    transport: "streamable-http" as const,
  };
}

export function callSellerSpriteTool(
  tool: string,
  args: Record<string, unknown>,
) {
  return callRemoteTool(config(), tool, args);
}

export function listSellerSpriteTools() {
  return listRemoteTools(config());
}
