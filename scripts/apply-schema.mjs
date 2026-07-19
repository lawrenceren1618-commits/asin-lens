import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL  DATABASE_URL missing");
  process.exit(1);
}

const drizzleDir = resolve("drizzle");
const files = readdirSync(drizzleDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const client = postgres(url, { prepare: false, max: 1, connect_timeout: 30 });

try {
  for (const file of files) {
    const sqlText = readFileSync(resolve(drizzleDir, file), "utf8");
    await client.unsafe(sqlText);
    console.log(`PASS  applied ${file}`);
  }
  console.log("PASS  schema applied");
} catch (error) {
  console.error(
    `FAIL  ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
