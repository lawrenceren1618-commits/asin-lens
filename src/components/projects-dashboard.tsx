"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, FolderPlus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client-auth";

type Project = { id: string; name: string; createdAt: string };

export function ProjectsDashboard() {
  const [items, setItems] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setError("");
    setLoading(true);
    try {
      const data = (await apiFetch("/api/projects")) as { items: Project[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = (await apiFetch("/api/projects")) as { items: Project[] };
        if (!cancelled) setItems(data.items);
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

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  return (
    <AppShell
      title="项目工作台"
      subtitle="记录 ASIN 变化，梳理产品脉络：清楚、可追溯、可总结。"
    >
      <div className="grid gap-16 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(0,14rem)]">
        <section className="space-y-8">
          <div>
            <p className="text-xs tracking-[0.18em] text-primary/70 uppercase">
              New
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold">
              创建项目
            </h2>
          </div>
          <form className="space-y-4" onSubmit={createProject}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="项目名称"
              required
            />
            <Button type="submit" className="gap-2">
              <FolderPlus className="size-4" />
              开始
            </Button>
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </section>

        <section className="min-h-[20rem] space-y-8">
          <div>
            <p className="text-xs tracking-[0.18em] text-primary/70 uppercase">
              Projects
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold">
              已有项目
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {loading
                ? "加载中…"
                : items.length === 0
                  ? "还没有项目。"
                  : `${items.length} 个`}
            </p>
          </div>

          <div className="space-y-4">
            {items.length === 0 && !loading && (
              <p className="max-w-xs text-sm leading-7 text-muted-foreground">
                空着也没关系。准备好时，从左侧起一个名字。
              </p>
            )}
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/projects/${item.id}`}
                className="group flex max-w-md items-center justify-between border-b border-white/10 py-4 transition hover:border-primary/35"
              >
                <div>
                  <div className="font-medium transition group-hover:text-primary">
                    {item.name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground/60 transition group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>

        <aside className="hidden space-y-6 text-sm leading-7 text-muted-foreground lg:block">
          <p>
            把每次采集写成可回溯的节点。
            <br />
            日报在北京时间上午九点整理，也可随时打开「报告」。
          </p>
          <Link href="/reports" className="inline-block text-primary/90 hover:underline">
            前往报告 →
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
