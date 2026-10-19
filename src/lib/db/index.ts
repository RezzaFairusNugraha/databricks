import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

const dbDir = path.join(process.cwd(), ".data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "csv_tidy.sqlite");
const dbUrl = process.env.DATABASE_URL || `file:${dbPath.replace(/\\/g, "/")}`;

const client = createClient({
  url: dbUrl,
});

export const db = drizzle(client, { schema });

let initialized = false;
export async function ensureDbInitialized() {
  if (initialized) return;

  await client.execute(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      target_table_name TEXT NOT NULL DEFAULT 'cleaned_table',
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS job_executions (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL UNIQUE,
      target_catalog TEXT NOT NULL,
      target_schema TEXT NOT NULL,
      target_table TEXT NOT NULL,
      write_mode TEXT NOT NULL DEFAULT 'create',
      status TEXT NOT NULL DEFAULT 'pending',
      clean_statement_id TEXT,
      quarantine_statement_id TEXT,
      rows_clean INTEGER DEFAULT 0,
      rows_quarantine INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  initialized = true;
}
