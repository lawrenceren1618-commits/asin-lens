"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Wrench } from "lucide-react";

import {
  STAGE_LABEL,
  type PipelineIssue,
} from "@/lib/research/pipeline-error";
import {
  loadResolvedIssueIds,
  saveResolvedIssueIds,
} from "@/lib/client-settings";

export function IssueChecklist({
  issues,
  title = "待处理问题",
}: {
  issues: PipelineIssue[];
  title?: string;
}) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  useEffect(() => {
    setResolved(loadResolvedIssueIds());
  }, []);

  if (issues.length === 0) return null;

  function toggle(id: string) {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveResolvedIssueIds(next);
      return next;
    });
  }

  const open = issues.filter((item) => !resolved.has(item.id));
  const done = issues.filter((item) => resolved.has(item.id));

  return (
    <div className="surface-panel rounded-2xl p-4 text-sm">
      <div className="mb-3 flex items-center gap-2">
        <Wrench className="size-4 text-primary" />
        <p className="font-medium">{title}</p>
        <span className="text-xs text-muted-foreground">
          未解决 {open.length} / 共 {issues.length}
        </span>
      </div>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">
        按清单逐项处理：先看「阶段」和「建议」，修好后点左侧标记。可重新采集验证。
      </p>
      <ul className="space-y-3">
        {[...open, ...done].map((item) => {
          const isDone = resolved.has(item.id);
          return (
            <li
              key={item.id}
              className={`rounded-xl border px-3 py-2.5 ${
                isDone ? "opacity-55" : "border-destructive/25"
              }`}
            >
              <button
                type="button"
                className="flex w-full items-start gap-2 text-left"
                onClick={() => toggle(item.id)}
              >
                {isDone ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    [{STAGE_LABEL[item.stage]}] {item.asin ?? "—"}
                    {item.market ? ` · ${item.market}` : ""} · {item.code}
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-6">
                    {item.message}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-primary/90">
                    建议：{item.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
