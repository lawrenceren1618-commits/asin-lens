"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { IndustryOptReportView } from "@/components/industry-opt-report-view";
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
import {
  loadSourcePriority,
  loadCommerceRates,
} from "@/lib/client-settings";
import { extractAsins } from "@/lib/asins/parse";
import type { PipelineIssue } from "@/lib/research/pipeline-error";

type AsinRole = "own" | "competitor";

type AsinRow = {
  id: string;
  asin: string;
  market: string;
  status: string;
  role: AsinRole;
  manualCvr60d: string | null;
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

type IndustryOptReport = {
  id: string;
  reportDate: string;
  mode: string;
  summaryMd: string;
  payload?: unknown;
};

type MetricKey = "price" | "traffic" | "sales" | "rank";
type RangePreset = "7" | "14" | "30" | "60" | "90" | "custom";

const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: "price", label: "价格" },
  { key: "traffic", label: "流量" },
  { key: "sales", label: "销量" },
  { key: "rank", label: "排名" },
];

const METRIC_LABEL: Record<MetricKey, string> = {
  price: "价格",
  traffic: "流量",
  sales: "销量",
  rank: "排名",
};

const MANUAL_CVR_HINT =
  "参考路径：亚马逊后台 → 业务报告 → 按子 ASIN 查看近 60 天整体转化率，作为本 ASIN 基准；主要流量词转化来自 Sif，仅作对照。";

function snapshotValue(row: Snapshot, metric: MetricKey): number | null {
  const raw = row[metric];
  if (raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function daysForChartRange(
  preset: RangePreset,
  rangeFrom: string,
  rangeTo: string,
): number {
  if (preset !== "custom") return Number(preset);
  if (!rangeFrom) return 90;
  const start = new Date(`${rangeFrom}T00:00:00Z`);
  const end = rangeTo
    ? new Date(`${rangeTo}T00:00:00Z`)
    : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 90;
  const diff =
    Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return Math.min(365, Math.max(7, diff + 3));
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const [projectName, setProjectName] = useState("");
  const [autoDaily, setAutoDaily] = useState(false);
  const [autoDailySaving, setAutoDailySaving] = useState(false);
  const [asins, setAsins] = useState<AsinRow[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [industryReports, setIndustryReports] = useState<IndustryOptReport[]>(
    [],
  );
  const [market, setMarket] = useState("US");
  const [ownInput, setOwnInput] = useState("");
  const [competitorInput, setCompetitorInput] = useState("");
  const [multiPick, setMultiPick] = useState<{
    asins: string[];
    ownSelected: string[];
    /** 粘贴来源入口：用于默认勾选 */
    source: AsinRole;
  } | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>([
    "traffic",
  ]);
  const [selectedAsinId, setSelectedAsinId] = useState<string>("all");
  const [rangePreset, setRangePreset] = useState<RangePreset>("30");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<PipelineIssue[]>([]);
  const [cvrDrafts, setCvrDrafts] = useState<Record<string, string>>({});
  const [nameDraft, setNameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDuplicate, setNameDuplicate] = useState<{
    suggestedName: string;
    message: string;
  } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [loadingCore, setLoadingCore] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [appliedChartDays, setAppliedChartDays] = useState(30);
  const snapshotsLoadedForDays = useRef<number | null>(null);

  const chartFetchDays = useMemo(
    () => daysForChartRange(rangePreset, rangeFrom, rangeTo),
    [rangePreset, rangeFrom, rangeTo],
  );

  const ownAsins = useMemo(
    () => asins.filter((row) => row.role === "own"),
    [asins],
  );
  const competitorAsins = useMemo(
    () => asins.filter((row) => row.role !== "own"),
    [asins],
  );

  type ProjectPayload = {
    project: { name: string; autoDaily?: boolean };
    asins: AsinRow[];
    snapshots: Snapshot[];
    reports: Report[];
    industryOptReports: IndustryOptReport[];
  };

  function applyCorePayload(data: ProjectPayload) {
    setProjectName(data.project.name);
    setNameDraft(data.project.name);
    setAutoDaily(Boolean(data.project.autoDaily));
    setNameDuplicate(null);
    setAsins(data.asins);
    setReports(data.reports);
    setIndustryReports(data.industryOptReports ?? []);
    const drafts: Record<string, string> = {};
    for (const row of data.asins) {
      drafts[row.id] = row.manualCvr60d ?? "";
    }
    setCvrDrafts(drafts);
  }

  /** 首屏：项目 + ASIN + 报告（跳过趋势快照，避免报告被拖慢） */
  async function refreshCore() {
    setError("");
    const data = (await apiFetch(
      `/api/projects/${projectId}?snapshots=0`,
    )) as ProjectPayload;
    applyCorePayload(data);
  }

  /** 趋势快照；可与 core 分离，不阻塞报告区 */
  async function refreshSnapshots(days: number) {
    setError("");
    const data = (await apiFetch(
      `/api/projects/${projectId}?days=${days}`,
    )) as ProjectPayload;
    setSnapshots(data.snapshots);
    // 顺带刷新 ASIN 最新列，但不清空已有报告
    setAsins(data.asins);
    snapshotsLoadedForDays.current = days;
    setAppliedChartDays(days);
  }

  async function refresh() {
    setError("");
    await refreshCore();
    await refreshSnapshots(chartFetchDays);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingCore(true);
      setError("");
      try {
        await refreshCore();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoadingCore(false);
      }

      if (cancelled) return;
      setLoadingCharts(true);
      try {
        await refreshSnapshots(30);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "趋势数据加载失败");
        }
      } finally {
        if (!cancelled) setLoadingCharts(false);
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
    // 仅项目切换时整页重载；改图表窗口另走 applyChartRange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function applyChartRange(daysOverride?: number) {
    const days =
      typeof daysOverride === "number" && Number.isFinite(daysOverride)
        ? daysOverride
        : chartFetchDays;
    if (
      snapshotsLoadedForDays.current !== null &&
      days <= snapshotsLoadedForDays.current
    ) {
      // 已拉更大窗口：只前端裁剪
      setAppliedChartDays(days);
      return;
    }
    setLoadingCharts(true);
    setError("");
    try {
      await refreshSnapshots(days);
    } catch (err) {
      setError(err instanceof Error ? err.message : "趋势数据加载失败");
    } finally {
      setLoadingCharts(false);
    }
  }

  const chartData = useMemo(() => {
    if (selectedMetrics.length === 0) return [];

    let filtered =
      selectedAsinId === "all"
        ? snapshots
        : snapshots.filter((row) => row.asinId === selectedAsinId);

    if (rangePreset === "custom" && rangeFrom) {
      filtered = filtered.filter((row) => {
        if (row.snapshotDate < rangeFrom) return false;
        if (rangeTo && row.snapshotDate > rangeTo) return false;
        return true;
      });
    } else if (rangePreset !== "custom") {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - appliedChartDays);
      const sinceDate = since.toISOString().slice(0, 10);
      filtered = filtered.filter((row) => row.snapshotDate >= sinceDate);
    }

    const multiMetric = selectedMetrics.length > 1;
    const byDate = new Map<string, Record<string, number | string>>();
    for (const row of filtered) {
      const key = row.snapshotDate;
      const point = byDate.get(key) ?? { date: key };
      for (const metric of selectedMetrics) {
        const value = snapshotValue(row, metric);
        if (value === null) continue;
        const seriesKey = multiMetric
          ? `${row.asin}-${row.market}·${METRIC_LABEL[metric]}`
          : `${row.asin}-${row.market}`;
        point[seriesKey] = value;
      }
      byDate.set(key, point);
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [
    snapshots,
    selectedAsinId,
    selectedMetrics,
    rangePreset,
    rangeFrom,
    rangeTo,
    appliedChartDays,
  ]);

  const seriesKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const point of chartData) {
      for (const key of Object.keys(point)) {
        if (key !== "date") keys.add(key);
      }
    }
    return [...keys];
  }, [chartData]);

  function toggleMetric(metric: MetricKey) {
    setSelectedMetrics((current) => {
      if (current.includes(metric)) {
        return current.filter((item) => item !== metric);
      }
      return [...current, metric];
    });
  }

  function selectAllMetrics() {
    setSelectedMetrics(METRIC_OPTIONS.map((item) => item.key));
  }

  async function archiveAsinList(
    items: Array<{ asin: string; role: AsinRole }>,
  ) {
    if (items.length === 0) return;
    setArchiving(true);
    setMessage("");
    setError("");
    setIssues([]);
    const summaries: string[] = [];
    const failures: PipelineIssue[] = [];

    try {
      for (const item of items) {
        setMessage(`正在建档 ${item.asin}（${item.role === "own" ? "我的" : "竞品"}）…`);
        const added = (await apiFetch(`/api/projects/${projectId}/asins`, {
          method: "POST",
          body: JSON.stringify({
            asin: item.asin,
            market,
            role: item.role,
          }),
        })) as {
          row: { id: string; asin: string };
          created: boolean;
        };

        try {
          const collect = (await apiFetch("/api/collect", {
            method: "POST",
            body: JSON.stringify({
              asinId: added.row.id,
              sourcePriority: loadSourcePriority(),
            }),
          })) as {
            result?: {
              asin: string;
              metrics?: {
                title: string | null;
                price: number | null;
                sales: number | null;
                rank: number | null;
                traffic: number | null;
              };
            };
          };
          const m = collect.result?.metrics;
          const title = m?.title?.slice(0, 60) || "（无标题）";
          summaries.push(
            `${item.asin}[${item.role === "own" ? "我的" : "竞品"}] ${title}${
              m?.price != null ? ` · $${m.price}` : ""
            }`,
          );
        } catch (err) {
          if (err instanceof ApiError) {
            const payload = err.payload as { failures?: PipelineIssue[] };
            failures.push(...(payload.failures ?? []));
            summaries.push(`${item.asin} 采集失败：${err.message}`);
          } else {
            summaries.push(
              `${item.asin} 采集失败：${
                err instanceof Error ? err.message : "未知错误"
              }`,
            );
          }
        }
      }

      setIssues(failures);
      setMessage(`建档完成 ${items.length} 个：\n${summaries.join("\n")}`);
      setOwnInput("");
      setCompetitorInput("");
      setMultiPick(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "建档失败");
    } finally {
      setArchiving(false);
    }
  }

  function handleAsinPaste(
    event: React.ClipboardEvent<HTMLInputElement>,
    source: AsinRole,
  ) {
    const text = event.clipboardData.getData("text");
    if (!text.trim()) return;
    const parsed = extractAsins(text);
    if (!parsed.ok) {
      event.preventDefault();
      setError(parsed.error);
      setMessage("");
      return;
    }
    event.preventDefault();
    setError("");

    if (parsed.asins.length === 1) {
      if (source === "own") setOwnInput(parsed.asins[0]);
      else setCompetitorInput(parsed.asins[0]);
      setMessage(
        `已识别 ASIN：${parsed.asins[0]}，点「识别建档」写入${
          source === "own" ? "我的" : "竞品"
        }。`,
      );
      return;
    }

    setMultiPick({
      asins: parsed.asins,
      ownSelected: source === "own" ? [...parsed.asins] : [],
      source,
    });
    setMessage(
      `识别到 ${parsed.asins.length} 个 ASIN，请在弹层中勾选「我的」，其余为竞品。`,
    );
  }

  function submitSingleEntry(
    event: React.FormEvent,
    source: AsinRole,
  ) {
    event.preventDefault();
    const raw = source === "own" ? ownInput : competitorInput;
    const parsed = extractAsins(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      setMessage("");
      return;
    }
    if (parsed.asins.length > 1) {
      setMultiPick({
        asins: parsed.asins,
        ownSelected: source === "own" ? [...parsed.asins] : [],
        source,
      });
      return;
    }
    void archiveAsinList([{ asin: parsed.asins[0], role: source }]);
  }

  function toggleMultiOwn(asinCode: string) {
    setMultiPick((current) => {
      if (!current) return current;
      const has = current.ownSelected.includes(asinCode);
      return {
        ...current,
        ownSelected: has
          ? current.ownSelected.filter((item) => item !== asinCode)
          : [...current.ownSelected, asinCode],
      };
    });
  }

  function confirmMultiPick() {
    if (!multiPick) return;
    const ownSet = new Set(multiPick.ownSelected);
    const items = multiPick.asins.map((code) => ({
      asin: code,
      role: (ownSet.has(code) ? "own" : "competitor") as AsinRole,
    }));
    void archiveAsinList(items);
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
            hint: "按行号改 CSV 后重新上传；asin 需为 10 位字母数字；role 用 own/competitor。",
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

  async function patchAsin(
    asinId: string,
    patch: { role?: AsinRole; manualCvr60d?: number | null },
  ) {
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/projects/${projectId}/asins/${asinId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setMessage("已更新");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失败");
    }
  }

  async function saveManualCvr(asinId: string) {
    const raw = (cvrDrafts[asinId] ?? "").trim();
    if (!raw) {
      await patchAsin(asinId, { manualCvr60d: null });
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("转化率需为 0–100 的数字");
      return;
    }
    await patchAsin(asinId, { manualCvr60d: value });
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

  async function toggleAutoDaily(next: boolean) {
    setAutoDailySaving(true);
    setError("");
    setMessage("");
    try {
      const data = (await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ autoDaily: next }),
      })) as { project: { autoDaily?: boolean; name: string } };
      setAutoDaily(Boolean(data.project.autoDaily));
      setMessage(
        data.project.autoDaily
          ? "已设为自动项目：每日北京 09:00 采集 + 异动日报 + 行业报告并推送"
          : "已关闭自动日更（仅手动采集/生成）",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新自动项目失败");
    } finally {
      setAutoDailySaving(false);
    }
  }

  async function generateIndustryOpt() {
    setGeneratingReport(true);
    setMessage("正在生成最新行业/优化报告（需调 MCP，请稍候）…");
    setError("");
    try {
      const data = (await apiFetch(
        `/api/projects/${projectId}/industry-opt-reports`,
        {
          method: "POST",
          body: JSON.stringify({ commerceRates: loadCommerceRates() }),
        },
      )) as { report: IndustryOptReport; canonical: { mode: string } };
      setMessage(
        data.canonical.mode === "industry_plus_own"
          ? "已生成最新：行业报告 + 我方可优化（已落库，下次打开秒出）"
          : "已生成最新：行业竞品报告（已落库，下次打开秒出）",
      );
      await refreshCore();
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setGeneratingReport(false);
    }
  }

  async function saveProjectName(options?: {
    acceptDuplicateSuffix?: boolean;
  }) {
    const trimmed = nameDraft.trim();
    setMessage("");
    setError("");
    if (!trimmed) {
      setError("项目名称不能为空");
      setNameDuplicate(null);
      return;
    }
    if (trimmed === projectName.trim() && !options?.acceptDuplicateSuffix) {
      setNameDuplicate(null);
      setMessage("名称未改动");
      return;
    }

    setRenaming(true);
    try {
      const data = (await apiFetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: trimmed,
          ...(options?.acceptDuplicateSuffix
            ? { acceptDuplicateSuffix: true }
            : {}),
        }),
      })) as { project: { name: string } };
      setProjectName(data.project.name);
      setNameDraft(data.project.name);
      setNameDuplicate(null);
      setMessage(
        data.project.name !== trimmed
          ? `已保存为「${data.project.name}」`
          : "项目名称已更新",
      );
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.payload &&
        typeof err.payload === "object"
      ) {
        const payload = err.payload as {
          error?: string;
          suggestedName?: string;
        };
        if (payload.suggestedName) {
          setNameDuplicate({
            suggestedName: payload.suggestedName,
            message:
              payload.error ??
              `已有同名项目。坚持保存将命名为「${payload.suggestedName}」。`,
          });
          setRenaming(false);
          return;
        }
      }
      setNameDuplicate(null);
      setError(err instanceof Error ? err.message : "改名失败");
    } finally {
      setRenaming(false);
    }
  }

  function renderAsinTable(rows: AsinRow[], section: AsinRole) {
    if (rows.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {section === "own"
            ? "暂无我的 ASIN。可不填——将只输出行业竞品报告；也可从竞品列表勾选升级，或上方录入。"
            : "暂无竞品 ASIN。"}
        </p>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 pr-3">ASIN</th>
              <th className="py-2 pr-3">角色</th>
              {section === "own" ? (
                <th className="py-2 pr-3">60 天转化基准%</th>
              ) : null}
              <th className="py-2 pr-3">状态</th>
              <th className="py-2 pr-3">最新更新</th>
              <th className="py-2 pr-3">标题</th>
              <th className="py-2 pr-3">价格</th>
              <th className="py-2 pr-3">流量</th>
              <th className="py-2 pr-3">流量词</th>
              <th className="py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top">
                <td className="py-2 pr-3 font-medium">
                  {row.asin}
                  <div className="text-xs text-muted-foreground">
                    {row.market}
                  </div>
                </td>
                <td className="py-2 pr-3">
                  {row.role === "own" ? "我的" : "竞品"}
                </td>
                {section === "own" ? (
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="h-8 w-24"
                        value={cvrDrafts[row.id] ?? ""}
                        onChange={(event) =>
                          setCvrDrafts((prev) => ({
                            ...prev,
                            [row.id]: event.target.value,
                          }))
                        }
                        placeholder="如 12.5"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void saveManualCvr(row.id)}
                      >
                        保存
                      </Button>
                    </div>
                  </td>
                ) : null}
                <td className="py-2 pr-3">
                  {row.status === "new" ? "新增" : "现有"}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {row.lastSyncedAt
                    ? new Date(row.lastSyncedAt).toLocaleString("zh-CN")
                    : "-"}
                </td>
                <td className="py-2 pr-3 max-w-[160px] truncate">
                  {row.latest?.title ?? "-"}
                </td>
                <td className="py-2 pr-3">{row.latest?.price ?? "-"}</td>
                <td className="py-2 pr-3">{row.latest?.traffic ?? "-"}</td>
                <td className="py-2 pr-3 max-w-[140px] truncate">
                  {(row.latest?.topKeywords ?? []).join(", ") || "-"}
                </td>
                <td className="py-2">
                  {row.role === "own" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void patchAsin(row.id, { role: "competitor" })
                      }
                    >
                      标为竞品
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void patchAsin(row.id, { role: "own" })}
                    >
                      标为我的
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <AppShell
      title={projectName || "项目详情"}
      subtitle="已进入本项目：采集与报告。竞品看行业，有我的 ASIN 再出可优化项。"
    >
      <div className="mb-6 space-y-4 rounded-2xl border border-primary/20 bg-primary/[0.04] px-5 py-4">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/projects" className="transition hover:text-primary">
            项目工作台
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-foreground">
            {projectName || "加载中…"}
          </span>
        </nav>
        <div>
          <p className="text-xs tracking-[0.16em] text-primary/70 uppercase">
            本项目工作中
          </p>
          <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight">
            {projectName || "…"}
          </h2>
        </div>
        <ol className="flex flex-wrap gap-2 text-xs sm:text-sm">
          {[
            { step: "1", label: "选定项目", active: true },
            { step: "2", label: "建档采集", active: true },
            { step: "3", label: "行业报告", active: true },
          ].map((item) => (
            <li
              key={item.step}
              className={`rounded-full border px-3 py-1 ${
                item.active
                  ? "border-primary/40 bg-background/80 text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              <span className="text-muted-foreground">{item.step}.</span>{" "}
              {item.label}
            </li>
          ))}
        </ol>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>项目名称</CardTitle>
          <CardDescription>可随时修改；与已有项目重名时会提示并可选加后缀。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveProjectName();
            }}
          >
            <Input
              value={nameDraft}
              onChange={(event) => {
                setNameDraft(event.target.value);
                setNameDuplicate(null);
              }}
              placeholder="项目名称"
              disabled={renaming}
              className="max-w-md"
              required
            />
            {nameDuplicate ? (
              <>
                <Button
                  type="button"
                  disabled={renaming}
                  onClick={() =>
                    void saveProjectName({ acceptDuplicateSuffix: true })
                  }
                >
                  {renaming
                    ? "保存中…"
                    : `坚持保存为 ${nameDuplicate.suggestedName}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={renaming}
                  onClick={() => {
                    setNameDraft(projectName);
                    setNameDuplicate(null);
                  }}
                >
                  取消
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                variant="outline"
                disabled={
                  renaming ||
                  !nameDraft.trim() ||
                  nameDraft.trim() === projectName.trim()
                }
              >
                {renaming ? "保存中…" : "保存名称"}
              </Button>
            )}
          </form>
          {nameDuplicate ? (
            <p className="text-sm leading-6 text-amber-700/90 dark:text-amber-200/90">
              {nameDuplicate.message}
            </p>
          ) : null}
          <label className="flex flex-wrap items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={autoDaily}
              disabled={autoDailySaving}
              onChange={(event) => void toggleAutoDaily(event.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">自动项目</span>
              <span className="mt-1 block text-muted-foreground">
                开启后每日北京时间 09:00：采集字段 → 生成异动日报 + 行业/优化报告 →
                飞书/邮件推送。关闭则仅手动。
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap gap-3">
        <Button type="button" onClick={() => void collect()}>
          采集全部 ASIN
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={generatingReport}
          onClick={() => void generateIndustryOpt()}
        >
          {generatingReport ? "生成最新中…" : "生成最新报告"}
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

      {generatingReport ? (
        <div
          className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6"
          role="status"
          aria-live="polite"
        >
          正在生成<strong>最新</strong>行业报告（调用 SellerSprite / Sif，通常需数十秒到数分钟）。下方仍可先看已落库的上一版；完成后自动换成最新。
        </div>
      ) : null}

      {(message || error) && (
        <p
          className={`mb-4 whitespace-pre-wrap text-sm ${
            error ? "text-destructive" : ""
          }`}
        >
          {error || message}
        </p>
      )}

      {issues.length > 0 ? (
        <div className="mb-4">
          <IssueChecklist issues={issues} title="采集报错清单" />
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">站点</span>
        <Input
          value={market}
          onChange={(event) => setMarket(event.target.value)}
          placeholder="US"
          className="w-24"
          disabled={archiving}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>添加我的 ASIN</CardTitle>
            <CardDescription>
              粘贴单个或多个 ASIN / 链接。多个时会弹出勾选框确认「我的」。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(event) => submitSingleEntry(event, "own")}
            >
              <Input
                value={ownInput}
                onChange={(event) => {
                  setOwnInput(event.target.value);
                  setError("");
                }}
                onPaste={(event) => handleAsinPaste(event, "own")}
                placeholder="粘贴我的 ASIN 或链接"
                disabled={archiving}
                className="min-w-[14rem] flex-1"
              />
              <Button
                type="submit"
                disabled={archiving || !ownInput.trim()}
              >
                {archiving ? "建档中…" : "识别建档"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>添加竞品 ASIN</CardTitle>
            <CardDescription>
              独立入口。粘贴多个时同样弹出勾选：勾选的为「我的」，其余为竞品。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(event) => submitSingleEntry(event, "competitor")}
            >
              <Input
                value={competitorInput}
                onChange={(event) => {
                  setCompetitorInput(event.target.value);
                  setError("");
                }}
                onPaste={(event) => handleAsinPaste(event, "competitor")}
                placeholder="粘贴竞品 ASIN 或链接"
                disabled={archiving}
                className="min-w-[14rem] flex-1"
              />
              <Button
                type="submit"
                disabled={archiving || !competitorInput.trim()}
              >
                {archiving ? "建档中…" : "识别建档"}
              </Button>
            </form>
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={archiving}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadCsv(file);
              }}
            />
            <p className="text-xs text-muted-foreground">
              CSV 仍可用 role 列（own / competitor）。
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            行业/优化报告
            {industryReports.length > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {industryReports.length} 份
              </span>
            ) : null}
          </CardTitle>
          <CardDescription>
            与日报分离。默认展示<strong>已落库</strong>上一版（秒出）；要最新请点上方「生成最新报告」并等待。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-sm leading-6">
            <p className="font-medium text-foreground">自动项目 · 每日 09:00</p>
            <p className="mt-1 text-muted-foreground">
              上方勾选「自动项目」后，Cron 每日采集并生成异动日报 + 行业报告并推送。打开页面仍秒出落库版；要立刻刷新可点「生成最新报告」。说明见{" "}
              <Link href="/rules" className="text-primary underline-offset-2 hover:underline">
                /rules
              </Link>
              。
            </p>
          </div>
          <IndustryOptReportView
            reports={industryReports}
            loading={loadingCore}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>每日报告</CardTitle>
          <CardDescription>价格 / 流量异常摘要（异动日报，独立保留）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingCore ? (
            <p className="text-sm text-muted-foreground">加载报告…</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无报告。</p>
          ) : (
            reports.map((report) => (
              <pre
                key={report.id}
                className="overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap"
              >
                {report.summaryMd}
              </pre>
            ))
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>图表选项</CardTitle>
            <CardDescription>
              勾选要看的指标（可多选），再选时间范围与 ASIN；下方趋势图只画所选字段。改范围后点「应用」才拉趋势（不阻塞上方报告）。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                指标
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {METRIC_OPTIONS.map((option) => {
                  const checked = selectedMetrics.includes(option.key);
                  return (
                    <label
                      key={option.key}
                      className="inline-flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMetric(option.key)}
                        className="size-4 accent-primary"
                      />
                      {option.label}
                    </label>
                  );
                })}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={selectAllMetrics}
                >
                  全选
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedMetrics([])}
                >
                  清空
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                时间范围
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={rangePreset}
                  onChange={(event) => {
                    const next = event.target.value as RangePreset;
                    setRangePreset(next);
                    if (next !== "custom") {
                      void applyChartRange(Number(next));
                    }
                  }}
                >
                  <option value="7">近 7 天</option>
                  <option value="14">近 14 天</option>
                  <option value="30">近 30 天</option>
                  <option value="60">近 60 天</option>
                  <option value="90">近 90 天</option>
                  <option value="custom">自定义</option>
                </select>
                {rangePreset === "custom" ? (
                  <>
                    <Input
                      type="date"
                      value={rangeFrom}
                      onChange={(event) => setRangeFrom(event.target.value)}
                      className="w-40"
                      aria-label="开始日期"
                    />
                    <span className="text-sm text-muted-foreground">至</span>
                    <Input
                      type="date"
                      value={rangeTo}
                      onChange={(event) => setRangeTo(event.target.value)}
                      className="w-40"
                      aria-label="结束日期"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loadingCharts || !rangeFrom}
                      onClick={() => void applyChartRange()}
                    >
                      {loadingCharts ? "加载中…" : "应用范围"}
                    </Button>
                  </>
                ) : null}
                {loadingCharts ? (
                  <span className="text-xs text-muted-foreground">趋势加载中…</span>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                ASIN
              </p>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={selectedAsinId}
                onChange={(event) => setSelectedAsinId(event.target.value)}
              >
                <option value="all">全部 ASIN</option>
                {asins.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.role === "own" ? "我的·" : "竞品·"}
                    {row.asin} ({row.market})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>趋势</CardTitle>
          <CardDescription>
            {selectedMetrics.length === 0
              ? "请至少勾选一个指标。"
              : `显示：${selectedMetrics.map((key) => METRIC_LABEL[key]).join("、")}${
                  rangePreset === "custom" && rangeFrom
                    ? ` · ${rangeFrom}${rangeTo ? ` 至 ${rangeTo}` : " 起"}`
                    : rangePreset !== "custom"
                      ? ` · 近 ${rangePreset} 天`
                      : ""
                }`}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          {selectedMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground">请勾选上方指标后再查看趋势。</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              该时间范围内暂无快照数据（需先采集；流量等字段无值时不会出线）。
            </p>
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
          <CardTitle>我的 ASIN（可选，可多变体）</CardTitle>
          <CardDescription>
            不提供则只出行业竞品报告；提供后额外输出可优化项。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {MANUAL_CVR_HINT}
          </p>
          {renderAsinTable(ownAsins, "own")}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>竞品 ASIN</CardTitle>
          <CardDescription>
            已有数据默认竞品。可从本表「标为我的」，或 CSV/手输指定。
          </CardDescription>
        </CardHeader>
        <CardContent>{renderAsinTable(competitorAsins, "competitor")}</CardContent>
      </Card>

      {multiPick ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="multi-asin-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border border-white/10 bg-card p-6 shadow-xl">
            <h3
              id="multi-asin-title"
              className="font-display text-xl font-semibold"
            >
              识别到 {multiPick.asins.length} 个 ASIN
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              勾选「我的」产品；未勾选的一律记为竞品。确认后再调用 MCP 建档。
            </p>
            <ul className="mt-4 space-y-2">
              {multiPick.asins.map((code) => {
                const isOwn = multiPick.ownSelected.includes(code);
                return (
                  <li
                    key={code}
                    className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-sm"
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isOwn}
                        disabled={archiving}
                        onChange={() => toggleMultiOwn(code)}
                        className="size-4 accent-primary"
                      />
                      <span className="font-mono tracking-wide">{code}</span>
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {isOwn ? "我的" : "竞品"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={archiving}
                onClick={() =>
                  setMultiPick((current) =>
                    current
                      ? { ...current, ownSelected: [...current.asins] }
                      : current,
                  )
                }
              >
                全选为我的
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={archiving}
                onClick={() =>
                  setMultiPick((current) =>
                    current ? { ...current, ownSelected: [] } : current,
                  )
                }
              >
                全部为竞品
              </Button>
              <div className="flex-1" />
              <Button
                type="button"
                variant="outline"
                disabled={archiving}
                onClick={() => setMultiPick(null)}
              >
                取消
              </Button>
              <Button
                type="button"
                disabled={archiving}
                onClick={() => confirmMultiPick()}
              >
                {archiving ? "建档中…" : "确认建档"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
