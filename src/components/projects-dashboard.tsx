"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, FolderPlus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/client-auth";

type Project = { id: string; name: string; createdAt: string; autoDaily?: boolean };

type DuplicateHint = {
  requestedName: string;
  suggestedName: string;
  message: string;
};

export function ProjectsDashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateHint | null>(null);
  const trimmedName = name.trim();

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

  async function createProject(
    event: React.FormEvent,
    options?: { acceptDuplicateSuffix?: boolean },
  ) {
    event.preventDefault();
    setError("");
    if (!trimmedName) {
      setError("项目名称不能为空");
      setDuplicate(null);
      return;
    }

    const acceptDuplicateSuffix = Boolean(options?.acceptDuplicateSuffix);
    if (
      !acceptDuplicateSuffix &&
      items.some((item) => item.name.trim() === trimmedName)
    ) {
      // 先本地提示；最终以 API 409 / 落库名为准
      let suffix = 1;
      const taken = new Set(items.map((item) => item.name.trim()));
      while (taken.has(`${trimmedName}${suffix}`)) suffix += 1;
      const suggestedName = `${trimmedName}${suffix}`;
      setDuplicate({
        requestedName: trimmedName,
        suggestedName,
        message: `已有同名项目「${trimmedName}」。坚持创建将命名为「${suggestedName}」。`,
      });
      return;
    }

    setCreating(true);
    try {
      const data = (await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          ...(acceptDuplicateSuffix ? { acceptDuplicateSuffix: true } : {}),
        }),
      })) as { project: Project };
      setName("");
      setDuplicate(null);
      router.push(`/projects/${data.project.id}`);
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
          setDuplicate({
            requestedName: trimmedName,
            suggestedName: payload.suggestedName,
            message:
              payload.error ??
              `已有同名项目。坚持创建将命名为「${payload.suggestedName}」。`,
          });
          setCreating(false);
          return;
        }
      }
      setError(err instanceof Error ? err.message : "创建失败");
      setDuplicate(null);
      setCreating(false);
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
          <form
            className="space-y-4"
            onSubmit={(event) => void createProject(event)}
          >
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setDuplicate(null);
                setError("");
              }}
              placeholder="项目名称"
              required
              disabled={creating}
              aria-invalid={Boolean(error && !trimmedName)}
            />
            {duplicate && duplicate.requestedName === trimmedName ? (
              <div className="space-y-3">
                <p className="text-sm leading-6 text-amber-700/90 dark:text-amber-200/90">
                  {duplicate.message}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={creating}
                    onClick={(event) =>
                      void createProject(event, {
                        acceptDuplicateSuffix: true,
                      })
                    }
                  >
                    <FolderPlus className="size-4" />
                    {creating
                      ? "进入中…"
                      : `坚持创建为 ${duplicate.suggestedName}`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={creating}
                    onClick={() => setDuplicate(null)}
                  >
                    改名
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="submit"
                className="gap-2"
                disabled={creating || !trimmedName}
              >
                <FolderPlus className="size-4" />
                {creating ? "进入中…" : "开始"}
              </Button>
            )}
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
                还没有项目。左侧起一个名字后点「开始」，会直接进入采集与报告页。
              </p>
            )}
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/projects/${item.id}`}
                className="group flex max-w-md items-center justify-between border-b border-white/10 py-4 transition hover:border-primary/35"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-medium transition group-hover:text-primary">
                    {item.name}
                    {item.autoDaily ? (
                      <span className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-normal tracking-wide text-primary">
                        自动 · 每日 09:00
                      </span>
                    ) : null}
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
            勾选「自动项目」后，北京时间每日 09:00 采集并生成异动日报 + 行业报告推送。
          </p>
          <Link href="/reports" className="inline-block text-primary/90 hover:underline">
            前往报告 →
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
