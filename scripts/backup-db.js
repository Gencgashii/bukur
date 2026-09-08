'use strict';
/**
 * Production-safe PostgreSQL logical backup for BUKUR WORLD.
 *
 *   node scripts/backup-db.js [--format custom|plain] [--schema-only] [--data-only]
 *                             [--dir <path>] [--gzip]
 *
 * Defaults: --format custom  ->  backups/bukur-db-<UTC>.dump  (pg_restore-able)
 *
 * Safety properties:
 *   - connection comes ONLY from DATABASE_URL (or BACKUP_DATABASE_URL); never
 *     hardcoded, never taken from argv.
 *   - the password is passed to pg_dump via the environment (PGPASSWORD), never
 *     on the command line, and is never printed or written to a filename.
 *   - fails (exit 1) if DATABASE_URL is missing or pg_dump is not found.
 *   - timestamped, non-user-controlled filenames.
 *   - refuses to overwrite an existing backup file.
 *   - reports success ONLY after pg_dump exits 0 and the file is non-empty;
 *     a partial file from a failed run is deleted.
 *   - one-shot CLI — NOT an in-process scheduler. Run it from cron / a CI job /
 *     a provider scheduled task.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// ---- load DATABASE_URL from .env if present (same pattern as other scripts) --
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

function fail(msg) {
  console.error(`[backup] ERROR: ${msg}`);
  process.exit(1);
}

const rawUrl = (process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || '').trim();
if (!rawUrl) fail('DATABASE_URL is not set. Set it in the environment (never commit it).');

let u;
try {
  u = new URL(rawUrl);
} catch {
  fail('DATABASE_URL is not a valid connection URL.');
}

// SSL: mirror server/db.js (DATABASE_SSL: 'true' => require, 'strict' => verify-full).
const dbSsl = (process.env.DATABASE_SSL || '').trim().toLowerCase();
const urlSslMode = u.searchParams.get('sslmode');
const sslmode = urlSslMode || (dbSsl === 'strict' ? 'verify-full' : dbSsl === 'true' ? 'require' : '');

const conn = {
  PGHOST: u.hostname,
  PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username || ''),
  PGPASSWORD: decodeURIComponent(u.password || ''),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')),
  ...(sslmode ? { PGSSLMODE: sslmode } : {}),
};
if (!conn.PGDATABASE) fail('DATABASE_URL has no database name.');

// ---- locate pg_dump ---------------------------------------------------------
function resolvePgDump() {
  if (process.env.PG_DUMP && fs.existsSync(process.env.PG_DUMP)) return process.env.PG_DUMP;
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['pg_dump'], { encoding: 'utf8' });
  if (probe.status === 0) {
    const first = probe.stdout.split(/\r?\n/).find(Boolean);
    if (first) return first.trim();
  }
  if (process.platform === 'win32') {
    const bases = ['C:/Program Files/PostgreSQL', 'C:/Program Files (x86)/PostgreSQL'];
    for (const b of bases) {
      if (!fs.existsSync(b)) continue;
      const vers = fs.readdirSync(b).sort().reverse();
      for (const v of vers) {
        const p = path.join(b, v, 'bin', 'pg_dump.exe');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}
const PG_DUMP = resolvePgDump();
if (!PG_DUMP) {
  fail('pg_dump not found. Install PostgreSQL client tools or set PG_DUMP=/path/to/pg_dump.');
}

// ---- output format + filename --------------------------------------------
const schemaOnly = has('--schema-only');
const dataOnly = has('--data-only');
if (schemaOnly && dataOnly) fail('--schema-only and --data-only are mutually exclusive.');
let format = opt('--format', 'custom').toLowerCase();
if (!['custom', 'plain'].includes(format)) fail('--format must be "custom" or "plain".');
if (schemaOnly || dataOnly) format = 'plain'; // schema/data-only are only meaningful as plain SQL here
const gzip = has('--gzip') && format === 'plain';

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); // 20260908T103000Z
const prefix = schemaOnly ? 'bukur-schema' : dataOnly ? 'bukur-data' : 'bukur-db';
const ext = format === 'custom' ? 'dump' : gzip ? 'sql.gz' : 'sql';
const outDir = path.resolve(opt('--dir', process.env.BACKUP_DIR || path.join(ROOT, 'backups')));
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${prefix}-${stamp}.${ext}`);
if (fs.existsSync(outFile)) fail(`refusing to overwrite existing backup: ${outFile}`);

// ---- build pg_dump args (NO connection info in argv) --------------------
const dumpArgs = ['--no-owner', '--no-privileges', '--verbose'];
if (format === 'custom') dumpArgs.push('--format=custom', '--compress=6');
else dumpArgs.push('--format=plain');
if (schemaOnly) dumpArgs.push('--schema-only');
if (dataOnly) dumpArgs.push('--data-only');

const childEnv = { ...process.env, ...conn };

console.log(`[backup] pg_dump: ${PG_DUMP}`);
console.log(`[backup] source : ${conn.PGUSER}@${conn.PGHOST}:${conn.PGPORT}/${conn.PGDATABASE}${sslmode ? ` (sslmode=${sslmode})` : ''}`);
console.log(`[backup] format : ${format}${schemaOnly ? ' (schema-only)' : dataOnly ? ' (data-only)' : ''}`);
console.log(`[backup] target : ${outFile}`);

async function runDump() {
  if (gzip) {
    // pg_dump | gzip > file  — done in Node to stay cross-platform.
    const zlib = require('zlib');
    const { spawn } = require('child_process');
    const gz = zlib.createGzip({ level: 6 });
    const ws = fs.createWriteStream(outFile);
    const child = spawn(PG_DUMP, dumpArgs, { env: childEnv, stdio: ['ignore', 'pipe', 'inherit'] });
    child.stdout.pipe(gz).pipe(ws);
    const code = await new Promise((res) => child.on('close', res));
    await new Promise((res) => ws.on('close', res));
    return code;
  }
  const ws = fs.openSync(outFile, 'w');
  const r = spawnSync(PG_DUMP, dumpArgs, { env: childEnv, stdio: ['ignore', ws, 'inherit'] });
  fs.closeSync(ws);
  return r.status;
}

(async () => {
  const started = Date.now();
  const status = await runDump();

  if (status !== 0) {
    try { fs.rmSync(outFile, { force: true }); } catch {}
    fail(`pg_dump exited with code ${status}. Backup NOT created.`);
  }

  const size = fs.statSync(outFile).size;
  if (size < 512) {
    try { fs.rmSync(outFile, { force: true }); } catch {}
    fail(`backup file is suspiciously small (${size} bytes). Treating as failure.`);
  }

  const sha = crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
  fs.writeFileSync(`${outFile}.sha256`, `${sha}  ${path.basename(outFile)}\n`);

  let toc = '';
  if (format === 'custom') {
    const pgRestore = path.join(path.dirname(PG_DUMP), process.platform === 'win32' ? 'pg_restore.exe' : 'pg_restore');
    const list = spawnSync(pgRestore, ['-l', outFile], { encoding: 'utf8' });
    if (list.status === 0) {
      const entries = list.stdout.split(/\r?\n/).filter((l) => l && !l.startsWith(';')).length;
      toc = ` | ${entries} archive entries`;
    }
  }

  console.log(`[backup] OK  ${outFile}`);
  console.log(`[backup]     ${(size / 1024).toFixed(1)} KB | sha256 ${sha}${toc} | ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log('[backup] NEXT: copy this file (and .sha256) to durable OFF-CONTAINER storage. Do not commit it.');
})().catch((e) => fail(e.message));
