import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  asinLensSql?: ReturnType<typeof postgres>;
  asinLensDb?: Db;
};

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalForDb.asinLensSql) {
    globalForDb.asinLensSql = postgres(connectionString, {
      prepare: false,
      max: 5,
    });
  }
  if (!globalForDb.asinLensDb) {
    globalForDb.asinLensDb = drizzle(globalForDb.asinLensSql, { schema });
  }
  return globalForDb.asinLensDb;
}
