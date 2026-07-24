"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatMetricAvailability } from "@/lib/research/keyword-traffic";
import {
  verifyIndustryOptCanonical,
  type IndustryOptCanonical,
} from "@/lib/research/industry-opt-format";
import { formatTrafficSourceLine } from "@/lib/research/traffic-source";
import { FIRST_MILE_MODE_LABEL } from "@/lib/research/commerce-rates";
import { TOP3_CONCENTRATION_THRESHOLD } from "@/lib/research/keyword-traffic";

export type IndustryOptReportRow = {
  id: string;
  reportDate: string;
  mode: string;
  summaryMd: string;
  payload?: unknown;
};

function pct(share: number | null): string {
  if (share === null) return "—";
  return `${(share * 100).toFixed(1)}%`;
}

function patternLabel(
  pattern: "concentrated" | "dispersed" | "unknown",
): string {
  if (pattern === "concentrated") return "集中型";
  if (pattern === "dispersed") return "分散型";
  return "未知";
}

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function KeywordTable({
  rows,
  showBidSpend,
  manualCvr60d,
}: {
  rows: IndustryOptCanonical["industry"]["competitors"][number]["topKeywords"];
  showBidSpend?: boolean;
  manualCvr60d?: number | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">暂无词级数据。</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-muted-foreground">
            <th className="py-2 pr-3 font-medium">词</th>
            <th className="py-2 pr-3 font-medium">份额</th>
            <th className="py-2 pr-3 font-medium">日均</th>
            <th className="py-2 pr-3 font-medium">转化</th>
            {showBidSpend ? (
              <>
                <th className="py-2 pr-3 font-medium">竞价</th>
                <th className="py-2 font-medium">花费</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((kw) => {
            const cvrText =
              kw.cvr.status === "no_result" &&
              manualCvr60d != null &&
              Number.isFinite(manualCvr60d)
                ? `${formatMetricAvailability(kw.cvr)}；对照手填整体 ${manualCvr60d}%`
                : formatMetricAvailability(kw.cvr);
            return (
              <tr
                key={`${kw.keyword}-${kw.source}`}
                className="border-b border-white/5 align-top"
              >
                <td className="max-w-[12rem] py-2 pr-3">{kw.keyword}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{pct(kw.share)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {dash(kw.dailyTraffic)}
                </td>
                <td className="py-2 pr-3 text-muted-foreground">{cvrText}</td>
                {showBidSpend ? (
                  <>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {formatMetricAvailability(kw.bid)}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {formatMetricAvailability(kw.spend)}
                    </td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MetricStrip({
  price,
  traffic,
  sales,
  rank,
}: {
  price: number | null;
  traffic: number | null;
  sales: number | null;
  rank: number | null;
}) {
  const items = [
    { label: "价格", value: dash(price) },
    { label: "流量", value: dash(traffic) },
    { label: "销量", value: dash(sales) },
    { label: "排名", value: dash(rank) },
  ];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {items.map((item) => (
        <div key={item.label}>
          <span className="text-muted-foreground">{item.label} </span>
          <span className="font-medium tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function UnitEconomicsBlock({
  econ,
}: {
  econ: IndustryOptCanonical["industry"]["competitors"][number]["unitEconomics"];
}) {
  return (
    <div className="space-y-2 text-sm leading-7">
      <p>
        <span className="text-muted-foreground">大类：</span>
        {econ.rootCategory ?? "—"}
        <span className="text-muted-foreground">
          {" "}
          · 装量 {econ.packCount}
          {econ.packCountSource === "title" ? "（标题）" : "（默认1）"}
        </span>
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <span className="text-muted-foreground">单个均价 </span>
          <span className="font-medium tabular-nums">
            {dash(econ.unitAvgPrice)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">单个配送 </span>
          <span className="tabular-nums">
            {formatMetricAvailability(econ.unitAvgDelivery)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">单个FBA </span>
          <span className="tabular-nums">
            {formatMetricAvailability(econ.unitFbaFee)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">
            单个佣金({(econ.referralRate * 100).toFixed(0)}%){" "}
          </span>
          <span className="tabular-nums">
            {formatMetricAvailability(econ.unitReferralFee)}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground">
        计费重 {dash(econ.billableWeightKg)} kg · 头程
        {FIRST_MILE_MODE_LABEL[econ.firstMileMode]} {econ.firstMileRateCnyPerKg}{" "}
        CNY/kg · 头程单件{" "}
        {formatMetricAvailability(econ.firstMileUnitCostCny)} CNY /{" "}
        {formatMetricAvailability(econ.firstMileUnitCostUsd)} USD
      </p>
      <p>
        <span className="text-muted-foreground">单件利润粗算(USD)：</span>
        <span className="font-medium tabular-nums">
          {formatMetricAvailability(econ.unitProfitProxyUsd)}
        </span>
        {econ.unitProfitProxyUsd.status === "ok" ? (
          <span className="text-muted-foreground">
            {" "}
            （有单个均价即粗算；配送/FBA/头程缺项未扣）
          </span>
        ) : null}
      </p>
    </div>
  );
}

function CanonicalBody({ report }: { report: IndustryOptCanonical }) {
  const modeLabel =
    report.mode === "industry_plus_own"
      ? "行业报告 + 我方可优化"
      : "行业竞品报告";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs tracking-[0.16em] text-primary/70 uppercase">
          {report.reportDate}
        </p>
        <h3 className="font-display text-xl font-semibold">{modeLabel}</h3>
        <p className="text-sm text-muted-foreground">
          竞品 {report.competitorCount} · 我的 {report.ownCount}
        </p>
      </header>

      <section className="space-y-3">
        <h4 className="text-sm font-medium tracking-wide">行业概览</h4>
        <p className="text-sm leading-7">
          标价带 {dash(report.industry.priceMin)} ~{" "}
          {dash(report.industry.priceMax)}
          <span className="text-muted-foreground">
            {" "}
            （中位 {dash(report.industry.priceMedian)}）
          </span>
        </p>
        <p className="text-sm leading-7">
          单个均价带 {dash(report.industry.unitAvgPriceMin)} ~{" "}
          {dash(report.industry.unitAvgPriceMax)}
          <span className="text-muted-foreground">
            {" "}
            （中位 {dash(report.industry.unitAvgPriceMedian)}）
          </span>
        </p>
        <p className="text-sm leading-7 text-muted-foreground">
          集中型 {report.industry.concentratedAsinCount} · 分散型{" "}
          {report.industry.dispersedAsinCount}
          <span className="block mt-1 text-xs">
            前三词合计份额 ≥ {TOP3_CONCENTRATION_THRESHOLD * 100}% 为集中型；否则标分散型（深挖另区）。
          </span>
        </p>
      </section>

      <section className="space-y-6">
        <h4 className="text-sm font-medium tracking-wide">竞品</h4>
        {report.industry.competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无竞品切片。</p>
        ) : (
          report.industry.competitors.map((item) => (
            <article
              key={`${item.asin}-${item.market}`}
              className="space-y-3 border-t border-white/10 pt-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h5 className="font-mono text-sm tracking-wide">
                  {item.asin}
                  <span className="ml-2 text-muted-foreground">
                    {item.market}
                  </span>
                </h5>
                <span className="text-xs text-muted-foreground">
                  {patternLabel(item.trafficPattern)}
                  {item.top3ShareSum !== null
                    ? ` · 前三 ${pct(item.top3ShareSum)}`
                    : ""}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {item.title || "（无标题）"}
              </p>
              <MetricStrip
                price={item.price}
                traffic={item.traffic}
                sales={item.sales}
                rank={item.rank}
              />
              <UnitEconomicsBlock econ={item.unitEconomics} />
              <p className="text-sm leading-6 text-muted-foreground">
                流量来源：{formatTrafficSourceLine(item.trafficSource)}
              </p>
              {item.trafficPattern === "dispersed" ? (
                <p className="text-sm text-muted-foreground">
                  结论：分散型流量（本报告不深挖）。
                </p>
              ) : null}
              <KeywordTable rows={item.topKeywords.slice(0, 5)} />
            </article>
          ))
        )}
      </section>

      {report.mode === "industry_plus_own" && report.ownOptimizations ? (
        <section className="space-y-6">
          <h4 className="text-sm font-medium tracking-wide">我方可优化</h4>
          {report.ownOptimizations.map((own) => (
            <article
              key={`${own.asin}-${own.market}`}
              className="space-y-3 border-t border-white/10 pt-5"
            >
              <h5 className="font-mono text-sm tracking-wide">
                {own.asin}
                <span className="ml-2 text-muted-foreground">
                  {own.market}
                </span>
              </h5>
              <p className="text-sm leading-7">
                <span className="text-muted-foreground">60 天整体 CVR（手填）：</span>
                {own.manualCvr60d === null
                  ? "未提供"
                  : `${own.manualCvr60d}%`}
              </p>
              <UnitEconomicsBlock econ={own.unitEconomics} />
              <div className="space-y-2 text-sm leading-7">
                <p>
                  <span className="text-muted-foreground">流量：</span>
                  {own.trafficNote}
                </p>
                <p className="text-muted-foreground">
                  流量来源：{formatTrafficSourceLine(own.trafficSource)}
                </p>
                <p>
                  <span className="text-muted-foreground">定价：</span>
                  {own.pricingNote}
                </p>
                <p>
                  <span className="text-muted-foreground">文案：</span>
                  {own.copyNote}
                </p>
                <p>
                  <span className="text-muted-foreground">单件经济：</span>
                  {own.economicsNote}
                </p>
              </div>
              <KeywordTable
                rows={own.keywordInsights.slice(0, 8)}
                showBidSpend
                manualCvr60d={own.manualCvr60d}
              />
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function SingleReport({
  row,
  defaultOpen,
}: {
  row: IndustryOptReportRow;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const verified = verifyIndustryOptCanonical(row.payload ?? {});
  const canonical = verified.ok ? verified.report : null;

  async function onCopy() {
    const ok = await copyText(row.summaryMd || "");
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="border-b border-white/10 pb-6 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="text-left text-sm font-medium transition hover:text-primary"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {row.reportDate}
          <span className="ml-2 font-normal text-muted-foreground">
            {row.mode === "industry_plus_own"
              ? "行业 + 可优化"
              : "行业竞品"}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            {open ? "收起" : "展开"}
          </span>
        </button>
        <Button type="button" size="sm" variant="outline" onClick={() => void onCopy()}>
          {copied ? "已复制" : "复制 Markdown"}
        </Button>
      </div>

      {open ? (
        <div className="mt-5">
          {canonical ? (
            <CanonicalBody report={canonical} />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                结构化数据缺失或校验未通过，回退显示原文。
              </p>
              <pre className="overflow-auto rounded-md bg-muted/60 p-3 text-xs whitespace-pre-wrap">
                {row.summaryMd || "（无内容）"}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function IndustryOptReportView({
  reports,
  loading = false,
}: {
  reports: IndustryOptReportRow[];
  loading?: boolean;
}) {
  if (loading && reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">加载报告…</p>
    );
  }

  if (reports.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        暂无。点上方「生成行业/优化报告」。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {reports.map((row, index) => (
        <SingleReport key={row.id} row={row} defaultOpen={index === 0} />
      ))}
    </div>
  );
}
