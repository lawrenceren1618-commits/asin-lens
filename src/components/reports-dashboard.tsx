"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/client-auth";

type ReportItem = {
  id: string;
  projectId: string;
  projectName: string;
  reportDate: string;
  summaryMd: string;
  anomalies: unknown;
  sentFeishuAt: string | null;
  sentEmailAt: string | null;
};

export function ReportsDashboard() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = (await apiFetch("/api/reports")) as {
          items: ReportItem[];
        };
        if (cancelled) return;
        setItems(data.items);
        setActiveId(data.items[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
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
  }, []);

  const active = items.find((item) => item.id === activeId) ?? null;

  return (
    <AppShell
      title="每日报告"
      subtitle="汇总昨日异动，沉淀可回溯的结论，服务下一步决策。"
    >
      <div className="grid gap-16 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,13rem)]">
        <section className="space-y-6">
          <p className="text-xs tracking-[0.18em] text-primary/70 uppercase">
            Timeline
          </p>
          {loading && (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && items.length === 0 && (
            <p className="max-w-[12rem] text-sm leading-7 text-muted-foreground">
              还没有报告。采集几天后，九点会自动生成。
            </p>
          )}
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className={`w-full border-b py-3 text-left transition ${
                    activeId === item.id
                      ? "border-primary/50 text-foreground"
                      : "border-white/10 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="text-sm font-medium">{item.reportDate}</div>
                  <div className="mt-1 text-xs opacity-80">
                    {item.projectName}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-h-[22rem]">
          {active ? (
            <article className="max-w-xl space-y-6">
              <header className="space-y-2">
                <p className="text-xs tracking-[0.18em] text-primary/70 uppercase">
                  Report
                </p>
                <h2 className="font-display text-3xl font-semibold">
                  {active.projectName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {active.reportDate}
                  {active.sentEmailAt ? " · 已发邮件" : ""}
                  {active.sentFeishuAt ? " · 已推飞书" : ""}
                </p>
              </header>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-8 text-foreground/90">
                {active.summaryMd}
              </pre>
              <Link
                href={`/projects/${active.projectId}`}
                className="inline-block text-sm text-primary hover:underline"
              >
                打开对应项目 →
              </Link>
            </article>
          ) : (
            !loading && (
              <p className="text-sm leading-7 text-muted-foreground">
                选择左侧一份报告开始阅读。
              </p>
            )
          )}
        </section>

        <aside className="hidden space-y-5 text-sm leading-7 text-muted-foreground lg:block">
          <p>
            按项目汇总昨日异常，便于对照历史、形成结论。
            <br />
            价格波动 ≥5%，流量波动 ≥20% 会标出。
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
