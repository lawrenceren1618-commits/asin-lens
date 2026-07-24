import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getPreviousChange } from "@/lib/db/queries";
import {
  asinChangeLog,
  asinSnapshots,
  asins,
  jobRuns,
} from "@/lib/db/schema";
import { syncChangeToFeishu } from "@/lib/feishu/archive";
import { callSellerSpriteTool } from "@/lib/mcp/sellersprite";
import { callSifTool } from "@/lib/mcp/sif";
import {
  prepareMetricsForStorage,
  type SnapshotMetrics,
} from "@/lib/research/metrics";
import type { SourceResult } from "@/lib/research/normalize";
import {
  issueFromCollectError,
  type PipelineIssue,
} from "@/lib/research/pipeline-error";
import {
  DEFAULT_SOURCE_PRIORITY,
  parseSourcePriority,
  type SourcePriorityConfig,
} from "@/lib/research/source-priority";
import { shanghaiDay } from "@/lib/time";

export type { SnapshotMetrics };

function changed(
  previous: {
    title: string | null;
    price: string | null;
    sales: number | null;
    rank: number | null;
    cart: string | null;
    traffic: string | null;
  } | null,
  next: SnapshotMetrics,
) {
  if (!previous) return true;
  const prevPrice = previous.price === null ? null : Number(previous.price);
  const prevTraffic =
    previous.traffic === null ? null : Number(previous.traffic);
  return (
    (previous.title ?? "") !== (next.title ?? "") ||
    prevPrice !== next.price ||
    previous.sales !== next.sales ||
    previous.rank !== next.rank ||
    (previous.cart ?? "") !== (next.cart ?? "") ||
    prevTraffic !== next.traffic
  );
}

async function collectOneAsin(
  asinId: string,
  priority: SourcePriorityConfig = DEFAULT_SOURCE_PRIORITY,
) {
  const db = getDb();
  const [asin] = await db.select().from(asins).where(eq(asins.id, asinId)).limit(1);
  if (!asin) throw new Error(`ASIN not found: ${asinId}`);

  const sources: SourceResult[] = [];

  try {
    const raw = await callSellerSpriteTool("asin_detail", {
      asin: asin.asin,
      marketplace: asin.market,
    });
    sources.push({ source: "SellerSprite", tool: "asin_detail", raw });
  } catch (error) {
    sources.push({
      source: "SellerSprite",
      tool: "asin_detail",
      raw: {
        error:
          error instanceof Error
            ? error.message
            : "SellerSprite asin_detail failed",
      },
    });
  }

  try {
    const raw = await callSellerSpriteTool("traffic_keyword", {
      asin: asin.asin,
      marketplace: asin.market,
    });
    sources.push({ source: "SellerSprite", tool: "traffic_keyword", raw });
  } catch {
    // optional enrichment
  }

  try {
    const raw = await callSellerSpriteTool("keepa_info", {
      asin: asin.asin,
      marketplace: asin.market,
    });
    sources.push({ source: "SellerSprite", tool: "keepa_info", raw });
  } catch {
    // optional — FBA 费用 / 包装重
  }

  // Sif schema: country（非 marketplace）；time_type=lately + time_value=7|30
  try {
    const raw = await callSifTool("market_get_asin_keyword_signals", {
      asin: asin.asin,
      country: asin.market,
      time_type: "lately",
      time_value: "7",
      listingSearch: false,
      topN: 50,
    });
    sources.push({
      source: "Sif",
      tool: "market_get_asin_keyword_signals",
      raw,
    });
  } catch {
    // Sif optional — SellerSprite alone may still verify.
  }

  try {
    const raw = await callSifTool("ops_get_listing_traffic_overview", {
      asin: asin.asin,
      country: asin.market,
      timePieceType: "latelyDay",
      timePieceValue: "7",
      isListingSearch: false,
    });
    sources.push({
      source: "Sif",
      tool: "ops_get_listing_traffic_overview",
      raw,
    });
  } catch {
    // optional — 流量来源（自然/广告）
  }

  // ingest → clean (by priority) → verify → only then write DB
  const { metrics, verify } = prepareMetricsForStorage(sources, priority);
  const day = shanghaiDay(new Date());
  const now = new Date();

  await db
    .insert(asinSnapshots)
    .values({
      asinId: asin.id,
      snapshotDate: day,
      title: metrics.title || null,
      price: metrics.price === null ? null : String(metrics.price),
      sales: metrics.sales,
      rank: metrics.rank,
      cart: metrics.cart || null,
      traffic: metrics.traffic === null ? null : String(metrics.traffic),
      topKeywords: metrics.topKeywords,
      keywordTraffic: metrics.keywordTraffic,
      rawRefs: metrics.rawRefs,
      observedAt: now,
    })
    .onConflictDoUpdate({
      target: [asinSnapshots.asinId, asinSnapshots.snapshotDate],
      set: {
        title: metrics.title || null,
        price: metrics.price === null ? null : String(metrics.price),
        sales: metrics.sales,
        rank: metrics.rank,
        cart: metrics.cart || null,
        traffic: metrics.traffic === null ? null : String(metrics.traffic),
        topKeywords: metrics.topKeywords,
        keywordTraffic: metrics.keywordTraffic,
        rawRefs: metrics.rawRefs,
        observedAt: now,
      },
    });

  const previous = await getPreviousChange(asin.id);
  if (changed(previous, metrics)) {
    if (previous && previous.effectiveTo < day) {
      // keep previous range as-is
    } else if (previous && previous.effectiveTo === day) {
      await db
        .update(asinChangeLog)
        .set({
          title: metrics.title || null,
          price: metrics.price === null ? null : String(metrics.price),
          sales: metrics.sales,
          rank: metrics.rank,
          cart: metrics.cart || null,
          traffic: metrics.traffic === null ? null : String(metrics.traffic),
          topKeywords: metrics.topKeywords,
        })
        .where(eq(asinChangeLog.id, previous.id));
    } else {
      if (previous) {
        const yesterday = new Date(`${day}T00:00:00+08:00`);
        yesterday.setDate(yesterday.getDate() - 1);
        const end = shanghaiDay(yesterday);
        if (end >= previous.effectiveFrom) {
          await db
            .update(asinChangeLog)
            .set({ effectiveTo: end })
            .where(eq(asinChangeLog.id, previous.id));
        }
      }

      const [log] = await db
        .insert(asinChangeLog)
        .values({
          asinId: asin.id,
          effectiveFrom: day,
          effectiveTo: day,
          title: metrics.title || null,
          price: metrics.price === null ? null : String(metrics.price),
          sales: metrics.sales,
          rank: metrics.rank,
          cart: metrics.cart || null,
          traffic: metrics.traffic === null ? null : String(metrics.traffic),
          topKeywords: metrics.topKeywords,
        })
        .returning();

      await syncChangeToFeishu({
        projectId: asin.projectId,
        asin: asin.asin,
        market: asin.market,
        log,
      }).catch(() => undefined);
    }
  } else if (previous) {
    await db
      .update(asinChangeLog)
      .set({ effectiveTo: day })
      .where(eq(asinChangeLog.id, previous.id));
  }

  await db
    .update(asins)
    .set({
      status: "existing",
      fetchStartedAt: asin.fetchStartedAt ?? now,
      lastSyncedAt: now,
    })
    .where(eq(asins.id, asin.id));

  return {
    asinId: asin.id,
    asin: asin.asin,
    day,
    metrics,
    verify: { ok: verify.ok, issues: verify.issues, hasSignal: verify.hasSignal },
  };
}

export async function collectProject(
  projectId: string,
  priorityInput?: unknown,
) {
  const priority = parseSourcePriority(priorityInput ?? DEFAULT_SOURCE_PRIORITY);
  const db = getDb();
  const [job] = await db
    .insert(jobRuns)
    .values({ kind: "collect", status: "running" })
    .returning();

  try {
    const rows = await db
      .select()
      .from(asins)
      .where(eq(asins.projectId, projectId));

    const results = [];
    const failures: PipelineIssue[] = [];

    for (const row of rows) {
      try {
        results.push(await collectOneAsin(row.id, priority));
      } catch (error) {
        failures.push(issueFromCollectError(row.asin, row.market, error));
      }
    }

    const status =
      failures.length === 0
        ? "success"
        : results.length > 0
          ? "success"
          : "failed";

    await db
      .update(jobRuns)
      .set({
        status,
        detail: `collected ${results.length}/${rows.length}; failed ${failures.length}`,
        finishedAt: new Date(),
      })
      .where(eq(jobRuns.id, job.id));

    if (results.length === 0 && failures.length > 0) {
      const summary = failures
        .map((f) => `[${f.stage}] ${f.asin}: ${f.message}`)
        .join(" | ");
      throw Object.assign(new Error(`全部 ASIN 失败（${failures.length}）: ${summary}`), {
        failures,
      });
    }

    return {
      jobId: job.id,
      count: results.length,
      results,
      failures,
      priority,
    };
  } catch (error) {
    await db
      .update(jobRuns)
      .set({
        status: "failed",
        detail: error instanceof Error ? error.message : "collect failed",
        finishedAt: new Date(),
      })
      .where(eq(jobRuns.id, job.id));
    throw error;
  }
}

export async function collectAsin(
  asinId: string,
  priorityInput?: unknown,
) {
  const priority = parseSourcePriority(priorityInput ?? DEFAULT_SOURCE_PRIORITY);
  return collectOneAsin(asinId, priority);
}
