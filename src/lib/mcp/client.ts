import "server-only";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type McpTransportKind = "streamable-http" | "sse";

export interface RemoteMcpConfig {
  name: string;
  version: string;
  url: string;
  headers: Record<string, string>;
  transport?: McpTransportKind;
}

function transportFor(config: RemoteMcpConfig) {
  const url = new URL(config.url);
  const requestInit = { headers: config.headers };

  if (config.transport === "sse") {
    return new SSEClientTransport(url, {
      requestInit,
      eventSourceInit: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          for (const [name, value] of Object.entries(config.headers)) {
            headers.set(name, value);
          }
          return fetch(input, {
            ...init,
            headers,
          });
        },
      },
    });
  }

  return new StreamableHTTPClientTransport(url, { requestInit });
}

export async function withMcpClient<T>(
  config: RemoteMcpConfig,
  operation: (client: Client) => Promise<T>,
) {
  const client = new Client({
    name: config.name,
    version: config.version,
  });

  try {
    await client.connect(transportFor(config));
    return await operation(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function callRemoteTool(
  config: RemoteMcpConfig,
  tool: string,
  args: Record<string, unknown>,
) {
  return withMcpClient(config, (client) =>
    client.callTool({ name: tool, arguments: args }),
  );
}

export async function listRemoteTools(config: RemoteMcpConfig) {
  return withMcpClient(config, (client) => client.listTools());
}
