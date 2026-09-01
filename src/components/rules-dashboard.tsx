"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadSourcePriority,
  saveSourcePriority,
  loadCommerceRates,
  saveCommerceRates,
} from "@/lib/client-settings";
import {
  FIRST_MILE_MODES,
  FIRST_MILE_MODE_LABEL,
  type CommerceRatesConfig,
  type FirstMileMode,
} from "@/lib/research/commerce-rates";
import {
  BUILTIN_SOURCES,
  DEFAULT_SOURCE_PRIORITY,
  FIELD_LABEL,
  METRIC_FIELDS,
  TRAFFIC_METRIC_FIELDS,
  type MetricField,
  type SourcePriorityConfig,
} from "@/lib/research/source-priority";

const ROADMAP = [
  {
    title: "行业报告周期自动生成（备用·可加长间隔）",
    detail:
      "若每日额度吃紧，可改为每 3 天只跑行业报告；异动日报仍可每日。当前默认：自动项目 = 每日采集 + 异动 + 行业。",
    status: "备用",
  },
  {
    title: "人工核对台",
    detail:
      "并排展示清洗前原始摘要与清洗后字段，支持逐条确认后再入库。适合争议数据。",
    status: "规划中",
  },
  {
    title: "导出 CSV / Excel",
    detail:
      "从规范快照再变换为你熟悉的表格列（中文表头），导出前同样走核对关口。",
    status: "规划中",
  },
  {
    title: "源健康检查",
    detail: "定时探测 SellerSprite / Sif 是否可用，并在采集前给出提示。",
    status: "规划中",
  },
] as const;

export function RulesDashboard() {
  const [config, setConfig] = useState<SourcePriorityConfig>(() => ({
    order: [...DEFAULT_SOURCE_PRIORITY.order],
    fields: { ...DEFAULT_SOURCE_PRIORITY.fields },
  }));
  const [commerce, setCommerce] = useState<CommerceRatesConfig>(() =>
    loadCommerceRates(),
  );
  const [newSource, setNewSource] = useState("");
  const [fieldEdit, setFieldEdit] = useState<MetricField | "">("");
  const [savedHint, setSavedHint] = useState("");

  useEffect(() => {
    setConfig(loadSourcePriority());
    setCommerce(loadCommerceRates());
  }, []);

  const known = useMemo(() => {
    const set = new Set<string>([...BUILTIN_SOURCES, ...config.order]);
    return [...set];
  }, [config.order]);

  function persist(next: SourcePriorityConfig) {
    setConfig(next);
    saveSourcePriority(next);
    setSavedHint("已保存，下次采集会按此优先级合并字段");
    window.setTimeout(() => setSavedHint(""), 2500);
  }

  function persistCommerce(next: CommerceRatesConfig) {
    setCommerce(next);
    saveCommerceRates(next);
    setSavedHint("已保存佣金/头程费率，生成行业报告时生效");
    window.setTimeout(() => setSavedHint(""), 2500);
  }

  function move(index: number, delta: number) {
    const next = [...config.order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    persist({ ...config, order: next });
  }

  function removeAt(index: number) {
    if (config.order.length <= 1) return;
    persist({
      ...config,
      order: config.order.filter((_, i) => i !== index),
    });
  }

  function addSource() {
    const name = newSource.trim();
    if (!name) return;
    if (config.order.includes(name)) {
      setNewSource("");
      return;
    }
    persist({ ...config, order: [...config.order, name] });
    setNewSource("");
  }

  function setFieldOrder(field: MetricField, order: string[]) {
    persist({
      ...config,
      fields: {
        ...config.fields,
        [field]: order,
      },
    });
  }

  function clearFieldOverride(field: MetricField) {
    const fields = { ...config.fields };
    delete fields[field];
    persist({ ...config, fields });
  }

  return (
    <AppShell
      title="数据规则"
      subtitle="源优先级、字段覆盖与后续能力入口。先定规则，再采集入库。"
    >
      <div className="grid max-h-full gap-6 overflow-y-auto pb-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="surface-panel space-y-4 rounded-2xl p-5">
          <div>
            <h2 className="text-base font-semibold">源优先级</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              越靠前越优先。同一字段多源都有值时，取排序更前的源。产品默认：流量相关（含词流量）Sif
              优先，标题/价/销量等其余字段 SellerSprite 优先；冲突照此执行。可手动调整或添加自定义源名。
            </p>
          </div>

          <ul className="space-y-2">
            {config.order.map((name, index) => (
              <li
                key={name}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
              >
                <span className="w-5 text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <span className="flex-1 font-medium">{name}</span>
                <button
                  type="button"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => move(index, -1)}
                  aria-label="上移"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => move(index, 1)}
                  aria-label="下移"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => removeAt(index)}
                  aria-label="移除"
                  disabled={config.order.length <= 1}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Input
              value={newSource}
              onChange={(event) => setNewSource(event.target.value)}
              placeholder="添加源名称，如 CustomMCP"
              className="max-w-xs"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSource();
                }
              }}
            />
            <Button type="button" onClick={addSource} className="gap-1">
              <Plus className="size-4" />
              添加
            </Button>
            {BUILTIN_SOURCES.filter((s) => !config.order.includes(s)).map(
              (name) => (
                <Button
                  key={name}
                  type="button"
                  variant="outline"
                  onClick={() =>
                    persist({ ...config, order: [...config.order, name] })
                  }
                >
                  + {name}
                </Button>
              ),
            )}
          </div>

          {savedHint ? (
            <p className="text-xs text-primary">{savedHint}</p>
          ) : null}

          <div className="border-t border-foreground/10 pt-4">
            <h3 className="text-sm font-medium">字段级覆盖（可选）</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              例如价格只用 SellerSprite，销量优先 Sif。不设则跟随全局顺序。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {METRIC_FIELDS.map((field) => {
                const isTraffic = (
                  TRAFFIC_METRIC_FIELDS as readonly string[]
                ).includes(field);
                return (
                <button
                  key={field}
                  type="button"
                  onClick={() =>
                    setFieldEdit((prev) => (prev === field ? "" : field))
                  }
                  className={`rounded-lg px-2.5 py-1 text-xs ${
                    fieldEdit === field || config.fields?.[field]
                      ? "bg-primary text-primary-foreground"
                      : "bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-muted-foreground"
                  }`}
                >
                  {FIELD_LABEL[field]}
                  {isTraffic ? " · 流量" : ""}
                  {config.fields?.[field] ? " · 已覆盖" : ""}
                </button>
                );
              })}
            </div>

            {fieldEdit ? (
              <div className="mt-3 rounded-xl border p-3">
                <p className="mb-2 text-xs font-medium">
                  {FIELD_LABEL[fieldEdit]} 的源顺序
                </p>
                <div className="flex flex-wrap gap-2">
                  {known.map((name) => {
                    const active = (
                      config.fields?.[fieldEdit] ?? config.order
                    ).includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`rounded-lg px-2 py-1 text-xs ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "border text-muted-foreground"
                        }`}
                        onClick={() => {
                          const current = [
                            ...(config.fields?.[fieldEdit] ?? [...config.order]),
                          ];
                          if (current.includes(name)) {
                            const next = current.filter((item) => item !== name);
                            if (next.length === 0) clearFieldOverride(fieldEdit);
                            else setFieldOrder(fieldEdit, next);
                          } else {
                            setFieldOrder(fieldEdit, [...current, name]);
                          }
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
                {config.fields?.[fieldEdit] ? (
                  <button
                    type="button"
                    className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => clearFieldOverride(fieldEdit)}
                  >
                    清除此字段覆盖
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="surface-panel space-y-4 rounded-2xl p-5">
          <div>
            <h2 className="text-base font-semibold">佣金与头程费率</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              佣金暂定售价的 15%（后续可上传类目表覆盖）。头程默认 6 CNY/kg，可按运输方式分别改。
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">佣金比例</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="w-28"
                value={commerce.commissionRate}
                onChange={(event) =>
                  persistCommerce({
                    ...commerce,
                    commissionRate: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">默认头程方式</span>
              <select
                className="flex h-10 rounded-md border bg-background px-3 text-sm"
                value={commerce.firstMileMode}
                onChange={(event) =>
                  persistCommerce({
                    ...commerce,
                    firstMileMode: event.target.value as FirstMileMode,
                  })
                }
              >
                {FIRST_MILE_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {FIRST_MILE_MODE_LABEL[mode]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">CNY→USD 汇率</span>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                className="w-28"
                value={commerce.fxCnyPerUsd}
                onChange={(event) =>
                  persistCommerce({
                    ...commerce,
                    fxCnyPerUsd: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIRST_MILE_MODES.map((mode) => (
              <label key={mode} className="space-y-1 text-sm">
                <span className="text-muted-foreground">
                  {FIRST_MILE_MODE_LABEL[mode]}（CNY/kg）
                </span>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={commerce.firstMileRatesCnyPerKg[mode]}
                  onChange={(event) =>
                    persistCommerce({
                      ...commerce,
                      firstMileRatesCnyPerKg: {
                        ...commerce.firstMileRatesCnyPerKg,
                        [mode]: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="surface-panel rounded-2xl border border-primary/30 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.02)]">
            <p className="text-xs tracking-[0.16em] text-primary/70 uppercase">
              已启用 · 自动项目
            </p>
            <h2 className="mt-2 text-base font-semibold">
              每日美西 03:00：采集 + 异动日报 + 行业报告
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              在项目详情勾选「自动项目」后纳入 Cron（
              <code className="text-xs">/api/cron/daily-report</code>
              ）。Vercel 在 UTC 10:00（夏令）/ 11:00（冬令）触发，约等于美西凌晨 3 点；写出的日期是
              <strong>已经过完的美西前一天</strong>
              ，不是北京日历、也不是邮箱显示时区。流程：MCP 采集 → 异动日报落库并推送 → 行业/优化报告落库并推送。手动「生成最新」仍可用。
              推送依赖 <code className="text-xs">FEISHU_BOT_WEBHOOK</code> / 邮件 env；未配则 skip。
            </p>
          </div>

          <div className="surface-panel rounded-2xl p-5">
            <h2 className="text-base font-semibold">后续能力入口</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              已写入产品路线，便于按优先级继续做。当前可先用源优先级 + 采集报错清单。
            </p>
            <ul className="mt-4 space-y-3">
              {ROADMAP.map((item) => (
                <li key={item.title} className="rounded-xl border px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface-panel rounded-2xl p-5 text-xs leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">稳定数据原则</p>
            <p className="mt-2">
              采集：原始 → 清洗 → 核对 → 入库。
              <br />
              导出：规范数据 → 核对 → 变成你熟悉的格式 → 再推送。
              <br />
              报错：标明阶段与建议，便于你一项一项解决。
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
