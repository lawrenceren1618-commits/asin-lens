"use client";

import Link from "next/link";

/** 优化后的模块树：分支 · kb · 一句话职责 */
const TREE = [
  {
    branch: "mod/contracts",
    file: "01-contracts.md",
    label: "角色·词指标·双报告",
  },
  {
    branch: "mod/frontend",
    file: "02-frontend.md",
    label: "我的/竞品 UI",
  },
  {
    branch: "mod/collect",
    file: "03-collect.md",
    label: "SS+Sif 采集",
  },
  {
    branch: "mod/report",
    file: "04-report.md",
    label: "日报·行业优化",
  },
  {
    branch: "mod/infra",
    file: "05-infra.md",
    label: "Schema·pooler",
  },
  {
    branch: "mod/vendor",
    file: "vendor/sif-mcp/",
    label: "Sif 能力边界",
  },
] as const;

/**
 * Right-rail map: reminds module ↔ git branch ↔ kb filename.
 * Soft visual only — not the product core.
 */
export function ModuleMap() {
  return (
    <aside className="pointer-events-auto absolute right-4 top-[14%] z-20 hidden w-[12.5rem] xl:block">
      <div className="rounded-xl border border-foreground/10 bg-[color-mix(in_oklch,var(--text-scrim)_88%,transparent)] px-3 py-3 backdrop-blur-md">
        <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          模块树
        </p>
        <p className="mt-1 text-[10px] leading-4 text-muted-foreground/90">
          own/竞品 · 双报告
        </p>
        <ul className="mt-2.5 space-y-1.5 font-mono text-[11px] leading-4">
          <li className="text-foreground/70">asin-lens/</li>
          {TREE.map((node, index) => (
            <li key={node.branch} className="pl-2">
              <span className="text-muted-foreground">
                {index === TREE.length - 1 ? "└ " : "├ "}
              </span>
              <span className="text-foreground/85">{node.branch}</span>
              <span className="mt-0.5 block pl-3 text-[10px] text-muted-foreground">
                └ {node.file}
                <span className="text-foreground/45"> · {node.label}</span>
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/rules"
          className="mt-3 block text-[10px] text-primary underline-offset-2 hover:underline"
        >
          数据规则 →
        </Link>
        <p className="mt-2 text-[9px] leading-3.5 text-muted-foreground/80">
          开聊：守则 + mod/… + 先读 kb；push 前写 07 总结
        </p>
      </div>
    </aside>
  );
}
