import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type AsinRole = "own" | "competitor";

export type KeywordTrafficRow = {
  keyword: string;
  share: number | null;
  dailyTraffic: number | null;
  cvr: number | null;
  bid: number | null;
  spend: number | null;
  source: "Sif" | "SellerSprite";
};

export type IndustryOptPayload = Record<string, unknown>;

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const asins = pgTable(
  "asins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    asin: text("asin").notNull(),
    market: text("market").notNull().default("US"),
    note: text("note"),
    /** own = 我的产品（可选，可多变体）；默认 competitor */
    role: text("role").$type<AsinRole>().notNull().default("competitor"),
    /** 用户手填：子 ASIN 近 60 天整体转化率（%） */
    manualCvr60d: numeric("manual_cvr_60d", { precision: 8, scale: 4 }),
    status: text("status").notNull().default("new"),
    fetchStartedAt: timestamp("fetch_started_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("asins_project_asin_market_uidx").on(
      table.projectId,
      table.asin,
      table.market,
    ),
    index("asins_project_id_idx").on(table.projectId),
  ],
);

export const asinSnapshots = pgTable(
  "asin_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    asinId: uuid("asin_id")
      .notNull()
      .references(() => asins.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    title: text("title"),
    price: numeric("price", { precision: 12, scale: 2 }),
    sales: integer("sales"),
    rank: integer("rank"),
    cart: text("cart"),
    traffic: numeric("traffic", { precision: 14, scale: 2 }),
    topKeywords: jsonb("top_keywords").$type<string[]>().default([]),
    keywordTraffic: jsonb("keyword_traffic")
      .$type<KeywordTrafficRow[]>()
      .default([]),
    rawRefs: jsonb("raw_refs").$type<Record<string, unknown>>().default({}),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("asin_snapshots_asin_date_uidx").on(
      table.asinId,
      table.snapshotDate,
    ),
    index("asin_snapshots_asin_id_idx").on(table.asinId),
  ],
);

export const asinChangeLog = pgTable(
  "asin_change_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    asinId: uuid("asin_id")
      .notNull()
      .references(() => asins.id, { onDelete: "cascade" }),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to").notNull(),
    title: text("title"),
    price: numeric("price", { precision: 12, scale: 2 }),
    sales: integer("sales"),
    rank: integer("rank"),
    cart: text("cart"),
    traffic: numeric("traffic", { precision: 14, scale: 2 }),
    topKeywords: jsonb("top_keywords").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("asin_change_log_asin_id_idx").on(table.asinId)],
);

export const dailyReports = pgTable(
  "daily_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    reportDate: date("report_date").notNull(),
    summaryMd: text("summary_md").notNull().default(""),
    anomalies: jsonb("anomalies")
      .$type<
        Array<{
          asin: string;
          market: string;
          field: string;
          previous: number | string | null;
          current: number | string | null;
          changePct: number | null;
        }>
      >()
      .default([]),
    sentFeishuAt: timestamp("sent_feishu_at", { withTimezone: true }),
    sentEmailAt: timestamp("sent_email_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("daily_reports_project_date_uidx").on(
      table.projectId,
      table.reportDate,
    ),
  ],
);

/** 与 daily_reports 分离：行业竞品 / 我方优化报告 */
export const industryOptReports = pgTable(
  "industry_opt_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    reportDate: date("report_date").notNull(),
    mode: text("mode").notNull(),
    summaryMd: text("summary_md").notNull().default(""),
    payload: jsonb("payload").$type<IndustryOptPayload>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("industry_opt_reports_project_date_uidx").on(
      table.projectId,
      table.reportDate,
    ),
    index("industry_opt_reports_project_id_idx").on(table.projectId),
  ],
);

export const jobRuns = pgTable("job_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  detail: text("detail"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
