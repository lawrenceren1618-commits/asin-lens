import "server-only";

import {
  callRemoteTool,
  listRemoteTools,
  type McpTransportKind,
} from "./client";

function config() {
  const secret = process.env.SIF_SECRET_KEY;
  if (!secret) {
    throw new Error("SIF_SECRET_KEY is not configured");
  }

  const header = process.env.SIF_AUTH_HEADER ?? "secret-key";
  const scheme = process.env.SIF_AUTH_SCHEME ?? "";
  const transport =
    process.env.SIF_TRANSPORT === "sse" ? "sse" : "streamable-http";
  const url = new URL(process.env.SIF_MCP_URL ?? "https://mcp.sif.com/mcp");
  url.searchParams.set("secret-key", secret);

  return {
    name: "amazon-user-research-sif",
    version: "0.1.0",
    url: url.toString(),
    headers: { [header]: `${scheme}${secret}` },
    transport: transport as McpTransportKind,
  };
}

export function callSifTool(tool: string, args: Record<string, unknown>) {
  return callRemoteTool(config(), tool, args);
}

export function listSifTools() {
  return listRemoteTools(config());
}
