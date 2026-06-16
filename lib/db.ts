/**
 * Postgres access (Neon). Vercel injects the right DATABASE_URL per
 * environment (preview DB on Preview, prod DB on Production), so the code
 * just reads process.env.DATABASE_URL. Pooled URL for serverless runtime.
 *
 * We store ONLY anonymous tournament templates + the single admin's auth row.
 * No visitor data, no IP, no analytics.
 */
import { Pool } from 'pg'

declare global { var _pgPool: Pool | undefined }

export function db(): Pool {
  if (!global._pgPool) {
    global._pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  }
  return global._pgPool
}

export async function ensureSchema(): Promise<void> {
  await db().query(`
    CREATE TABLE IF NOT EXISTS templates (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      config      JSONB NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS admin_auth (
      id            INTEGER PRIMARY KEY DEFAULT 1,
      email         TEXT NOT NULL,
      password_hash TEXT,
      reset_token   TEXT,
      reset_expires TIMESTAMPTZ,
      CONSTRAINT one_row CHECK (id = 1)
    );
  `)
}
