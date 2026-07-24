/**
 * Delete projects that have zero ASINs.
 * Usage: node scripts/cleanup-empty-projects.mjs
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL  DATABASE_URL missing");
  process.exit(1);
}

const client = postgres(url, { prepare: false, max: 1, connect_timeout: 30 });

try {
  const deleted = await client`
    DELETE FROM projects p
    WHERE NOT EXISTS (
      SELECT 1 FROM asins a WHERE a.project_id = p.id
    )
    RETURNING id, name
  `;
  console.log(`deleted ${deleted.length} empty project(s)`);
  for (const row of deleted) {
    console.log(`- ${row.id}  ${row.name}`);
  }
} catch (error) {
  console.error(
    `FAIL  ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
