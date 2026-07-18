import "server-only";

const FEISHU_API = "https://open.feishu.cn/open-apis";
const WRITE_BATCH_SIZE = 500;
const TABLE_RECORD_SOFT_LIMIT = 19_500;

type FeishuField = {
  field_name: string;
  type: number;
};

type FeishuRecord = {
  fields: Record<string, string | number | boolean>;
};

type FeishuResponse<T> = {
  code: number;
  msg: string;
  data: T;
};

type TableInfo = {
  table_id: string;
  name: string;
};

let cachedToken: { value: string; expiresAt: number } | undefined;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function tenantToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const response = await fetch(
    `${FEISHU_API}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        app_id: requiredEnv("FEISHU_APP_ID"),
        app_secret: requiredEnv("FEISHU_APP_SECRET"),
      }),
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as {
    code: number;
    msg: string;
    tenant_access_token?: string;
    expire?: number;
  };

  if (!response.ok || payload.code !== 0 || !payload.tenant_access_token) {
    throw new Error(`Feishu authentication failed: ${payload.msg}`);
  }

  cachedToken = {
    value: payload.tenant_access_token,
    expiresAt: Date.now() + (payload.expire ?? 7_200) * 1_000,
  };
  return cachedToken.value;
}

async function feishuRequest<T>(
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<T> {
  const response = await fetch(`${FEISHU_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${await tenantToken()}`,
      "content-type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("retry-after") ?? "1");
    await sleep(Math.max(1, retryAfter) * 1_000 * 2 ** attempt);
    return feishuRequest<T>(path, init, attempt + 1);
  }

  const payload = (await response.json()) as FeishuResponse<T>;
  if (!response.ok || payload.code !== 0) {
    throw new Error(
      `Feishu API ${path} failed (${payload.code}): ${payload.msg}`,
    );
  }
  return payload.data;
}

function basePath() {
  return `/bitable/v1/apps/${requiredEnv("FEISHU_BITABLE_APP_TOKEN")}`;
}

export async function listTables() {
  const tables: TableInfo[] = [];
  let pageToken: string | undefined;

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (pageToken) query.set("page_token", pageToken);
    const data = await feishuRequest<{
      items?: TableInfo[];
      has_more?: boolean;
      page_token?: string;
    }>(`${basePath()}/tables?${query}`);
    tables.push(...(data.items ?? []));
    pageToken = data.has_more ? data.page_token : undefined;
  } while (pageToken);

  return tables;
}

export async function ensureTable(name: string, fields: FeishuField[]) {
  const existing = (await listTables()).find((table) => table.name === name);
  if (existing) return existing.table_id;

  const data = await feishuRequest<{ table_id: string }>(
    `${basePath()}/tables`,
    {
      method: "POST",
      body: JSON.stringify({
        table: {
          name,
          default_view_name: "默认视图",
          fields,
        },
      }),
    },
  );
  return data.table_id;
}

export async function listRecordKeys(tableId: string) {
  const keys = new Set<string>();
  let total = 0;
  let pageToken: string | undefined;

  do {
    const query = new URLSearchParams({
      page_size: "500",
      field_names: JSON.stringify(["去重键"]),
    });
    if (pageToken) query.set("page_token", pageToken);
    const data = await feishuRequest<{
      items?: Array<{ fields: Record<string, unknown> }>;
      has_more?: boolean;
      page_token?: string;
      total?: number;
    }>(`${basePath()}/tables/${tableId}/records?${query}`);

    for (const item of data.items ?? []) {
      const key = item.fields["去重键"];
      if (typeof key === "string") keys.add(key);
    }
    total = data.total ?? total + (data.items?.length ?? 0);
    pageToken = data.has_more ? data.page_token : undefined;
  } while (pageToken);

  return { keys, total };
}

export async function appendRecords(
  tableId: string,
  records: FeishuRecord[],
) {
  for (const batch of chunks(records, WRITE_BATCH_SIZE)) {
    await feishuRequest(
      `${basePath()}/tables/${tableId}/records/batch_create`,
      {
        method: "POST",
        body: JSON.stringify({ records: batch }),
      },
    );
  }
}

export const taskFields: FeishuField[] = [
  { field_name: "任务ID", type: 1 },
  { field_name: "创建时间", type: 1 },
  { field_name: "SellerSprite工具", type: 1 },
  { field_name: "Sif工具", type: 1 },
  { field_name: "参数", type: 1 },
  { field_name: "状态", type: 1 },
];

export const logFields: FeishuField[] = [
  { field_name: "运行ID", type: 1 },
  { field_name: "任务ID", type: 1 },
  { field_name: "状态", type: 1 },
  { field_name: "开始时间", type: 1 },
  { field_name: "结束时间", type: 1 },
  { field_name: "写入数量", type: 2 },
  { field_name: "错误", type: 1 },
];

export const resultFields: FeishuField[] = [
  { field_name: "去重键", type: 1 },
  { field_name: "数据源", type: 1 },
  { field_name: "工具", type: 1 },
  { field_name: "任务ID", type: 1 },
  { field_name: "站点市场", type: 1 },
  { field_name: "ASIN关键词", type: 1 },
  { field_name: "采集时间", type: 1 },
  { field_name: "标准化数据", type: 1 },
  { field_name: "原始摘要", type: 1 },
];

export async function resolveResultsTable(
  day: string,
  incomingCount: number,
) {
  const tables = await listTables();
  for (let suffix = 1; suffix <= 20; suffix += 1) {
    const name = `结果_${day}${suffix === 1 ? "" : `_${suffix}`}`;
    const table =
      tables.find((candidate) => candidate.name === name) ??
      ({
        name,
        table_id: await ensureTable(name, resultFields),
      } satisfies TableInfo);
    const current = await listRecordKeys(table.table_id);
    if (current.total + incomingCount <= TABLE_RECORD_SOFT_LIMIT) {
      return { ...table, ...current };
    }
  }
  throw new Error(`No available Feishu result table for ${day}`);
}
