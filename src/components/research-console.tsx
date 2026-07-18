"use client";

import { useState, type FormEvent } from "react";
import { Database, Loader2, Play, PlugZap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ApiState =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "success"; data: unknown }
  | { kind: "error"; message: string };

function parseArguments(value: string) {
  const parsed: unknown = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("工具参数必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

export function ResearchConsole() {
  const [token, setToken] = useState("");
  const [market, setMarket] = useState("US");
  const [sellerTool, setSellerTool] = useState("");
  const [sellerArgs, setSellerArgs] = useState("{}");
  const [sifTool, setSifTool] = useState("");
  const [sifArgs, setSifArgs] = useState("{}");
  const [state, setState] = useState<ApiState>({ kind: "idle" });

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-admin-token": token,
        ...init?.headers,
      },
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? `请求失败 (${response.status})`);
    }
    return data;
  }

  async function checkConnections() {
    setState({ kind: "loading", message: "正在读取两个 MCP 的工具列表…" });
    try {
      const data = await request("/api/mcp-tools");
      setState({ kind: "success", data });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "连接检查失败",
      });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState({ kind: "loading", message: "调研运行中，请勿关闭页面…" });

    try {
      if (!sellerTool.trim() && !sifTool.trim()) {
        throw new Error("至少填写一个 MCP 工具名称");
      }

      const payload = {
        market,
        ...(sellerTool.trim()
          ? {
              sellerSprite: {
                tool: sellerTool.trim(),
                arguments: parseArguments(sellerArgs),
              },
            }
          : {}),
        ...(sifTool.trim()
          ? {
              sif: {
                tool: sifTool.trim(),
                arguments: parseArguments(sifArgs),
              },
            }
          : {}),
      };

      const data = await request("/api/research", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setState({ kind: "success", data });
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "调研失败",
      });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>新建调研任务</CardTitle>
          <CardDescription>
            工具名称和参数可先通过右侧的连接检查获取。留空的服务不会调用。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={submit}>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="token">
                管理令牌
              </label>
              <Input
                id="token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="ADMIN_TOKEN"
                required
              />
              <p className="text-xs text-muted-foreground">
                仅保存在当前页面内存中，不会写入浏览器存储。
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="market">
                站点 / 市场
              </label>
              <Input
                id="market"
                value={market}
                onChange={(event) => setMarket(event.target.value)}
                placeholder="US"
              />
            </div>

            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-2 font-medium">SellerSprite</legend>
              <Input
                value={sellerTool}
                onChange={(event) => setSellerTool(event.target.value)}
                placeholder="工具名称，例如 asin_detail"
              />
              <Textarea
                value={sellerArgs}
                onChange={(event) => setSellerArgs(event.target.value)}
                spellCheck={false}
                aria-label="SellerSprite JSON 参数"
              />
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="px-2 font-medium">Sif</legend>
              <Input
                value={sifTool}
                onChange={(event) => setSifTool(event.target.value)}
                placeholder="工具名称"
              />
              <Textarea
                value={sifArgs}
                onChange={(event) => setSifArgs(event.target.value)}
                spellCheck={false}
                aria-label="Sif JSON 参数"
              />
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={state.kind === "loading"}>
                {state.kind === "loading" ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Play className="mr-2 size-4" />
                )}
                开始调研
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={checkConnections}
                disabled={state.kind === "loading" || !token}
              >
                <PlugZap className="mr-2 size-4" />
                检查 MCP 连接
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5" />
              运行状态
            </CardTitle>
            <CardDescription>
              结果会写入飞书的按日结果表，任务与错误会写入控制表。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state.kind === "idle" && (
              <p className="text-sm text-muted-foreground">尚未执行操作。</p>
            )}
            {state.kind === "loading" && (
              <p className="flex items-center text-sm">
                <Loader2 className="mr-2 size-4 animate-spin" />
                {state.message}
              </p>
            )}
            {state.kind === "error" && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}
            {state.kind === "success" && (
              <pre className="max-h-[540px] overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(state.data, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
