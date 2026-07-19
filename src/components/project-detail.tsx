"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { IssueChecklist } from "@/components/issue-checklist";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/client-auth";
import { loadSourcePriority } from "@/lib/client-settings";
import type { PipelineIssue } from "@/lib/research/pipeline-error";

type AsinRow = {
  id: string;
  asin: string;
  market: string;
  status: string;
  note: string | null;
  fetchStartedAt: string | null;
  lastSyncedAt: string | null;
  latest: {
    title: string | null;
    price: string | null;
    sales: number | null;
    rank: number | null;
    cart: string | null;
    traffic: string | null;
    topKeywords: string[] | null;
  } | null;
};

type Snapshot = {
  asinId: string;
  asin: string;
  market: string;
  snapshotDate: string;
  price: string | null;
  traffic: string | null;
  sales: number | null;
  rank: number | null;
};

type Report = {
  id: string;
  reportDate: string;
  summaryMd: string;
  anomalies: unknown;
};

type MetricKey = "price" | "traffic" | "sales" | "rank";

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [projectName, setProjectName] = useState("");
  const [asins, setAsins] = useState<AsinRow[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [asin, setAsin] = useState("");
  const [market, setMarket] = useState("US");
  const [metric, setMetric] = useState<MetricKey>("price");
  const [selectedAsinId, setSelectedAsinId] = useState<string>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<PipelineIssue[]>([]);

  async function refresh() {
    setError("");
    const data = (await apiFetch(`/api/projects/${projectId}`)) as {
      project: { name: string };
      asins: AsinRow[];
      snapshots: Snapshot[];
      reports: Report[];
    };
    setProjectName(data.project.name);
    setAsins(data.asins);
    setSnapshots(data.snapshots);
    setReports(data.reports);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      try {
        const data = (await apiFetch(`/api/projects/${projectId}`)) as {
          project: { name: string };
          asins: AsinRow[];
          snapshots: Snapshot[];
          reports: Report[];
        };
        if (cancelled) return;
        setProjectName(data.project.name);
        setAsins(data.asins);
        setSnapshots(data.snapshots);
        setReports(data.reports);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      }
    }

    void load();
    const onSaved = () => {
      void load();
    };
    window.addEventListener("asin-lens-token-saved", onSaved);
    return () => {
      cancelled = true;
      window.removeEventListener("asin-lens-token-saved", onSaved);
    };
  }, [projectId]);

  const chartData = useMemo(() => {
    const filtered =
      selectedAsinId === "all"
        ? snapshots
        : snapshots.filter((row) => row.asinId === selectedAsinId);

    const byDate = new Map<string, Record<string, number | string>>();
    for (const row of filtered) {
      const key = row.snapshotDate;
      const point = byDate.get(key) ?? { date: key };
      const seriesKey = `${row.asin}-${row.market}`;
      const raw =
        metric === "sales" || metric === "rank"
          ? row[metric]
          : row[metric] === null
            ? null
            : Number(row[metric]);
      if (raw !== null && raw !== undefined && Number.isFinite(Number(raw))) {
        point[seriesKey] = Number(raw);
      }
      byDate.set(key, point);
    }
    return [...byDate.values()];
  }, [snapshots, selectedAsinId, metric]);

  const seriesKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const point of chartData) {
      for (const key of Object.keys(point)) {
        if (key !== "date") keys.add(key);
      }
    }
    return [...keys];
  }, [chartData]);

  async function addOne(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/asins`, {
        method: "POST",
        body: JSON.stringify({ asin, market }),
      });
      setAsin("");
      setMessage("ASIN 已添加");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  }

  async function uploadCsv(file: File) {
    setMessage("");
    setError("");
    const form = new FormData();
    form.set("file", file);
    try {
      const data = (await apiFetch(
        `/api/projects/${projectId}/asins/import`,
        {
          method: "POST",
          body: form,
        },
      )) as {
        created: number;
        skipped: number;
        errors: string[];
      };
      setMessage(
        `导入完成：新增 ${data.created}，跳过 ${data.skipped}${
          data.errors.length ? `；错误 ${data.errors.length} 条` : ""
        }`,
      );
      if (data.errors.length) {
        setIssues(
          data.errors.map((message, index) => ({
            id: `import|csv|${index}|${message.slice(0, 80)}`,
            stage: "clean" as const,
            code: "CSV_IMPORT",
            message,
            hint: "按行号改 CSV 后重新上传；asin 需为 10 位字母数字。",
          })),
        );
      } else {
        setIssues([]);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    }
  }

  async function collect() {
    setMessage("采集中…");
    setError("");
    setIssues([]);
    try {
      const data = (await apiFetch("/api/collect", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          sourcePriority: loadSourcePriority(),
        }),
      })) as { count: number; failures?: PipelineIssue[] };
      const failures = data.failures ?? [];
      setIssues(failures);
      setMessage(
        failures.length > 0
          ? `采集完成 ${data.count} 个；另有 ${failures.length} 条待处理`
          : `采集完成：${data.count} 个 ASIN`,
      );
      await refresh();
    } catch (err) {
      setMessage("");
      if (err instanceof ApiError) {
        const payload = err.payload as { failures?: PipelineIssue[] };
        setIssues(payload.failures ?? []);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "采集失败");
      }
    }
  }

  return (
    <AppShell
      title={projectName || "项目详情"}
      subtitle="采集快照、跟踪趋势、留下可追溯记录——看清历史，服务当下。"
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <Button type="button" onClick={() => void collect()}>
          采集全部 ASIN
        </Button>
        <Button type="button" variant="outline" onClick={() => void refresh()}>
          刷新
        </Button>
        <a
          className="inline-flex h-10 items-center rounded-md border px-4 text-sm"
          href="/templates/asin-import.csv"
        >
          下载 CSV 模板
        </a>
      </div>

      {(message || error) && (
        <p className={`mb-4 text-sm ${error ? "text-destructive" : ""}`}>
          {error || message}
        </p>
      )}

      {issues.length > 0 ? (
        <div className="mb-4">
          <IssueChecklist issues={issues} title="采集报错清单" />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>添加 ASIN</CardTitle>
            <CardDescription>单条录入或上传表格。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-wrap gap-2" onSubmit={addOne}>
              <Input
                value={asin}
                onChange={(event) => setAsin(event.target.value)}
                placeholder="ASIN"
                required
              />
              <Input
                value={market}
                onChange={(event) => setMarket(event.target.value)}
                placeholder="US"
                className="w-24"
              />
              <Button type="submit">添加</Button>
            </form>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadCsv(file);
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>图表选项</CardTitle>
            <CardDescription>选择指标与 ASIN。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={metric}
              onChange={(event) => setMetric(event.target.value as MetricKey)}
            >
              <option value="price">价格</option>
              <option value="traffic">流量</option>
              <option value="sales">销量</option>
              <option value="rank">排名</option>
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={selectedAsinId}
              onChange={(event) => setSelectedAsinId(event.target.value)}
            >
              <option value="all">全部 ASIN</option>
              {asins.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.asin} ({row.market})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>趋势</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无快照数据。</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {seriesKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={`hsl(${(index * 67) % 360} 55% 40%)`}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>ASIN 列表</CardTitle>
          <CardDescription>
            状态、开始获取时间、最新更新与核心指标。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-3">ASIN</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">开始获取</th>
                <th className="py-2 pr-3">最新更新</th>
                <th className="py-2 pr-3">标题</th>
                <th className="py-2 pr-3">价格</th>
                <th className="py-2 pr-3">流量</th>
                <th className="py-2 pr-3">销量</th>
                <th className="py-2 pr-3">排名</th>
                <th className="py-2 pr-3">购物车</th>
                <th className="py-2">流量词</th>
              </tr>
            </thead>
            <tbody>
              {asins.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="py-2 pr-3 font-medium">
                    {row.asin}
                    <div className="text-xs text-muted-foreground">
                      {row.market}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    {row.status === "new" ? "新增" : "现有"}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {row.fetchStartedAt
                      ? new Date(row.fetchStartedAt).toLocaleString("zh-CN")
                      : "-"}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {row.lastSyncedAt
                      ? new Date(row.lastSyncedAt).toLocaleString("zh-CN")
                      : "-"}
                  </td>
                  <td className="py-2 pr-3 max-w-[180px] truncate">
                    {row.latest?.title ?? "-"}
                  </td>
                  <td className="py-2 pr-3">{row.latest?.price ?? "-"}</td>
                  <td className="py-2 pr-3">{row.latest?.traffic ?? "-"}</td>
                  <td className="py-2 pr-3">{row.latest?.sales ?? "-"}</td>
                  <td className="py-2 pr-3">{row.latest?.rank ?? "-"}</td>
                  <td className="py-2 pr-3">{row.latest?.cart ?? "-"}</td>
                  <td className="py-2 max-w-[160px] truncate">
                    {(row.latest?.topKeywords ?? []).join(", ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>每日报告</CardTitle>
          <CardDescription>价格 / 流量异常摘要。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reports.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无报告。</p>
          )}
          {reports.map((report) => (
            <pre
              key={report.id}
              className="overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap"
            >
              {report.summaryMd}
            </pre>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
