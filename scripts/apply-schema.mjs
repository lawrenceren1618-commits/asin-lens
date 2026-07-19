import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL  DATABASE_URL missing");
  process.exit(1);
}

const sqlText = readFileSync(
  resolve("drizzle/0000_init.sql"),
  "utf8",
);

const client = postgres(url, { prepare: false, max: 1, connect_timeout: 30 });

try {
  await client.unsafe(sqlText);
  console.log("PASS  schema applied");
} catch (error) {
  console.error(
    `FAIL  ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
