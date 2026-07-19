import { readFileSync, writeFileSync } from "node:fs";
import dns from "node:dns";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

dns.setDefaultResultOrder("ipv4first");
config({ path: ".env.local" });

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("FAIL  DATABASE_URL missing");
  process.exit(1);
}

const u = new URL(raw);
const password = decodeURIComponent(u.password);
const passwordRaw = u.password;
const projectRef = u.hostname.startsWith("db.")
  ? u.hostname.slice(3).replace(".supabase.co", "")
  : null;

console.log(`diag.host=${u.hostname}`);
console.log(`diag.port=${u.port || "5432"}`);
console.log(`diag.projectRef=${projectRef ?? "(unknown)"}`);

async function tryUrl(label, url) {
  const client = postgres(url, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
    ssl: "require",
  });
  try {
    await client`select 1 as ok`;
    console.log(`OK  ${label}`);
    await client.end({ timeout: 2 });
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${label} :: ${detail.slice(0, 120)}`);
    try {
      await client.end({ timeout: 1 });
    } catch {
      // ignore
    }
    return false;
  }
}

function writeDatabaseUrl(nextUrl, label) {
  const envPath = resolve(".env.local");
  const text = readFileSync(envPath, "utf8");
  if (!/^DATABASE_URL=/m.test(text)) {
    throw new Error(".env.local has no DATABASE_URL line");
  }
  const updated = text.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${nextUrl}`);
  writeFileSync(envPath, updated, "utf8");
  console.log(`UPDATED .env.local DATABASE_URL -> ${label}`);
}

if (await tryUrl("current+ipv4first", raw)) {
  process.exit(0);
}

if (!projectRef) {
  console.error("FAIL  cannot derive projectRef");
  process.exit(2);
}

/** @type {Array<{ label: string; url: string }>} */
const candidates = [];

for (const port of ["6543", "5432"]) {
  candidates.push({
    label: `${projectRef}.pooler.supabase.com:${port}`,
    url: `postgresql://${encodeURIComponent(`postgres.${projectRef}`)}:${encodeURIComponent(password)}@${projectRef}.pooler.supabase.com:${port}/postgres`,
  });
}

const regions = [
  "us-west-2",
  "us-west-1",
  "us-east-1",
  "us-east-2",
  "ap-southeast-1",
  "ap-northeast-1",
  "eu-central-1",
];

for (const prefix of ["aws-0", "aws-1"]) {
  for (const region of regions) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    for (const port of ["6543", "5432"]) {
      for (const user of [`postgres.${projectRef}`, "postgres"]) {
        const mode = user.startsWith("postgres.") ? "project" : "plain";
        candidates.push({
          label: `${host}:${port}/${mode}`,
          url: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/postgres`,
        });
        candidates.push({
          label: `${host}:${port}/${mode}/rawPass`,
          url: `postgresql://${encodeURIComponent(user)}:${passwordRaw}@${host}:${port}/postgres`,
        });
      }
    }
  }
}

for (const item of candidates) {
  if (await tryUrl(item.label, item.url)) {
    writeDatabaseUrl(item.url, item.label);
    process.exit(0);
  }
}

console.error("FAIL  no working pooler endpoint found");
process.exit(3);
