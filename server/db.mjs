// One pool, and the migrations that made the tables it talks to.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.DATABASE_URL) {
  // Loud, at boot, rather than a 500 on the first request that mattered.
  throw new Error('DATABASE_URL is not set. The manager has no database and will not pretend otherwise.');
}

// `pg` currently reads sslmode=require as verify-full, and in its next major
// version the same string will mean libpq semantics instead -- which does not
// verify the certificate at all. So an `npm update` would drop TLS verification
// with nothing in the logs and no visible difference, which is the shape of
// failure this repository keeps finding: a wall that stops being one quietly.
//
// Only an explicit weak mode is upgraded. A connection string with no sslmode
// is left alone, so a local Postgres over a socket still works.
function pinnedTls(url) {
  const u = new URL(url);
  const mode = u.searchParams.get('sslmode');
  if (mode && ['prefer', 'require', 'verify-ca'].includes(mode)) {
    u.searchParams.set('sslmode', 'verify-full');
    console.log(`sslmode=${mode} pinned to verify-full`);
  }
  return u.toString();
}

export const pool = new pg.Pool({
  connectionString: pinnedTls(process.env.DATABASE_URL),
  // Neon scales to zero; a cold start is a slow first connection, not a fault.
  connectionTimeoutMillis: 15_000,
  max: 5,
});

export const q = (text, params) => pool.query(text, params);

// Migrations are files, applied in name order, recorded so they run once.
export async function migrate() {
  await q(`create table if not exists migration (
    name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await q('select name from migration')).rows.map((r) => r.name));
  const dir = path.join(ROOT, 'db');
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into migration (name) values ($1)', [name]);
      await client.query('commit');
      console.log(`migrated ${name}`);
    } catch (e) {
      await client.query('rollback');
      throw new Error(`migration ${name} failed: ${e.message}`);
    } finally {
      client.release();
    }
  }
}
