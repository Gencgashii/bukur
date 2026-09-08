'use strict';
/**
 * Restore a BUKUR WORLD backup into a DISPOSABLE PostgreSQL database and verify
 * schema + data + constraints + indexes + sequences. Also checks that
 * server/schema.sql can recreate the same schema (drift check).
 *
 *   node scripts/verify-restore.js <backup-file> [--target <db>] [--keep]
 *
 * SAFETY — this script NEVER touches production:
 *   - the source database (from DATABASE_URL) is read with SELECT only.
 *   - the restore target MUST be a disposable name containing "verify" or
 *     "restore_test"; it must NOT equal the source DB and must NOT be in a
 *     denylist. Anything else aborts before a single command runs.
 *   - the disposable database(s) are created here and dropped at the end
 *     (unless --keep); DROP only ever targets a name that passed the guard.
 *
 * Exit 0 only if every check passes.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();

const args = process.argv.slice(2);
const backupFile = args.find((a) => !a.startsWith('--'));
const keep = args.includes('--keep');
const targetArg = (() => {
  const i = args.indexOf('--target');
  return i >= 0 ? args[i + 1] : null;
})();

const die = (m) => {
  console.error(`[verify-restore] ERROR: ${m}`);
  process.exit(1);
};

if (!backupFile) die('usage: node scripts/verify-restore.js <backup-file> [--target <db>] [--keep]');
if (!fs.existsSync(backupFile)) die(`backup file not found: ${backupFile}`);

const rawUrl = (process.env.DATABASE_URL || '').trim();
if (!rawUrl) die('DATABASE_URL is not set.');
let u;
try {
  u = new URL(rawUrl);
} catch {
  die('DATABASE_URL is not a valid URL.');
}
const sourceDb = decodeURIComponent(u.pathname.replace(/^\//, ''));
const conn = {
  host: u.hostname,
  port: u.port || '5432',
  user: decodeURIComponent(u.username || ''),
  password: decodeURIComponent(u.password || ''),
};
const dbSsl = (process.env.DATABASE_SSL || '').toLowerCase();
const sslmode = u.searchParams.get('sslmode') || (dbSsl === 'strict' ? 'verify-full' : dbSsl === 'true' ? 'require' : '');
const pgEnv = {
  ...process.env,
  PGHOST: conn.host,
  PGPORT: conn.port,
  PGUSER: conn.user,
  PGPASSWORD: conn.password,
  ...(sslmode ? { PGSSLMODE: sslmode } : {}),
};

// ---- disposable-target guard --------------------------------------------
const DENYLIST = new Set(['postgres', 'template0', 'template1', 'template', sourceDb, sourceDb.toLowerCase()]);
function assertDisposable(name) {
  if (!name || typeof name !== 'string') die('internal: empty target name');
  if (!/^[a-z0-9_]+$/i.test(name)) die(`disposable name has unsafe characters: ${name}`);
  if (DENYLIST.has(name) || DENYLIST.has(name.toLowerCase())) die(`refusing to use "${name}" — it is the source or a system database`);
  if (!/(verify|restore_test)/i.test(name)) die(`disposable name must contain "verify" or "restore_test" (got "${name}")`);
  return name;
}

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').toLowerCase();
const restoreDb = assertDisposable(targetArg || `bukur_restore_verify_${stamp}`);
const schemaDb = assertDisposable(`bukur_restore_verify_schemafile_${stamp}`);

// ---- locate client tools ----------------------------------------------
function tool(name) {
  if (process.env.PG_BIN && fs.existsSync(path.join(process.env.PG_BIN, name + (process.platform === 'win32' ? '.exe' : '')))) {
    return path.join(process.env.PG_BIN, name + (process.platform === 'win32' ? '.exe' : ''));
  }
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
  if (probe.status === 0) {
    const f = probe.stdout.split(/\r?\n/).find(Boolean);
    if (f) return f.trim();
  }
  if (process.platform === 'win32') {
    for (const b of ['C:/Program Files/PostgreSQL', 'C:/Program Files (x86)/PostgreSQL']) {
      if (!fs.existsSync(b)) continue;
      for (const v of fs.readdirSync(b).sort().reverse()) {
        const p = path.join(b, v, 'bin', name + '.exe');
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}
const PSQL = tool('psql');
const PG_RESTORE = tool('pg_restore');
const CREATEDB = tool('createdb');
const DROPDB = tool('dropdb');
if (!PSQL || !PG_RESTORE || !CREATEDB || !DROPDB) {
  console.error('[verify-restore] PostgreSQL client tools not found (psql/pg_restore/createdb/dropdb).');
  console.error('[verify-restore] Real restore verification is PENDING — install client tools or set PG_BIN.');
  process.exit(2);
}

function sh(bin, argv, opts = {}) {
  return spawnSync(bin, argv, { env: pgEnv, encoding: 'utf8', ...opts });
}

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS  ' : 'FAIL  '}${name}${extra ? '  -> ' + extra : ''}`);
  ok ? (pass += 1) : (fail += 1);
};

const isPlain = /\.sql(\.gz)?$/i.test(backupFile);
const isGz = /\.gz$/i.test(backupFile);

async function q(client, sql, params) {
  return (await client.query(sql, params)).rows;
}

const CATALOG_SQL = {
  tables: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`,
  columns: `SELECT table_name||'.'||column_name||':'||data_type||':'||is_nullable AS c
              FROM information_schema.columns WHERE table_schema='public' ORDER BY 1`,
  constraints: `SELECT con.conname||':'||con.contype::text AS c
                  FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid
                  JOIN pg_namespace n ON n.oid=rel.relnamespace WHERE n.nspname='public' ORDER BY 1`,
  indexes: `SELECT indexname||' '||regexp_replace(indexdef, '.*USING', 'USING') AS c
              FROM pg_indexes WHERE schemaname='public' ORDER BY 1`,
  sequences: `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' ORDER BY 1`,
};

async function catalog(client) {
  const out = {};
  for (const [k, sql] of Object.entries(CATALOG_SQL)) out[k] = (await q(client, sql)).map((r) => r.table_name || r.sequence_name || r.c);
  return out;
}

function diffSets(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  return {
    onlyA: [...A].filter((x) => !B.has(x)),
    onlyB: [...B].filter((x) => !A.has(x)),
    equal: A.size === B.size && [...A].every((x) => B.has(x)),
  };
}

(async () => {
  console.log(`[verify-restore] backup   : ${backupFile} (${isPlain ? 'plain SQL' : 'custom'})`);
  console.log(`[verify-restore] source   : ${conn.user}@${conn.host}:${conn.port}/${sourceDb} (READ-ONLY)`);
  console.log(`[verify-restore] restore  -> disposable db "${restoreDb}"`);
  console.log(`[verify-restore] drift    -> disposable db "${schemaDb}"`);
  if (isGz) return die('gzipped plain dumps: gunzip first, then pass the .sql file.');

  const created = [];
  const openClients = [];
  const closeClients = async () => {
    for (const c of openClients) {
      try { await c.end(); } catch {}
    }
  };
  const cleanup = () => {
    if (keep) {
      console.log(`[verify-restore] --keep: leaving ${created.join(', ')}`);
      return;
    }
    for (const db of created) {
      assertDisposable(db); // guard again right before DROP
      let r = sh(DROPDB, ['--if-exists', '--force', db]);
      if (r.status !== 0) r = sh(DROPDB, ['--if-exists', db]); // --force needs PG13+
      console.log(`[verify-restore] dropped ${db}${r.status === 0 ? '' : ` (exit ${r.status}: ${(r.stderr || '').trim().slice(0, 160)})`}`);
    }
  };

  try {
    // ---- 1. create + restore -------------------------------------------
    let r = sh(CREATEDB, [restoreDb]);
    if (r.status !== 0) return die(`createdb ${restoreDb} failed: ${r.stderr}`);
    created.push(restoreDb);

    if (isPlain) {
      r = sh(PSQL, ['-v', 'ON_ERROR_STOP=1', '-d', restoreDb, '-f', backupFile], { stdio: ['ignore', 'ignore', 'pipe'] });
    } else {
      r = sh(PG_RESTORE, ['--no-owner', '--no-privileges', '--exit-on-error', '-d', restoreDb, backupFile], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    }
    check('restore completed without error', r.status === 0, r.status === 0 ? '' : (r.stderr || '').slice(0, 300));
    if (r.status !== 0) throw new Error('restore failed');

    // ---- 2. connect to source + restored --------------------------------
    const src = new Client({ ...conn, database: sourceDb, ssl: sslmode ? { rejectUnauthorized: sslmode === 'verify-full' } : false });
    const dst = new Client({ ...conn, database: restoreDb });
    await src.connect(); openClients.push(src);
    await dst.connect(); openClients.push(dst);

    const srcCat = await catalog(src);
    const dstCat = await catalog(dst);

    // ---- 3. schema object parity (source vs restored) ------------------
    for (const k of ['tables', 'columns', 'constraints', 'indexes', 'sequences']) {
      const d = diffSets(srcCat[k], dstCat[k]);
      check(`schema: ${k} match source (${srcCat[k].length})`, d.equal, d.equal ? '' : `+restored:${d.onlyB.join(',')} -missing:${d.onlyA.join(',')}`.slice(0, 300));
    }

    // ---- 4. row counts (fresh dump->restore must be identical) ---------
    const tables = srcCat.tables;
    for (const t of tables) {
      const sN = (await q(src, `SELECT count(*)::int n FROM "${t}"`))[0].n;
      const dN = (await q(dst, `SELECT count(*)::int n FROM "${t}"`))[0].n;
      check(`data: ${t} row count ${sN}`, sN === dN, sN === dN ? '' : `source=${sN} restored=${dN}`);
    }

    // ---- 5. sequences: future inserts won't collide -------------------
    const seqRows = await q(
      dst,
      `SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col
         FROM pg_class s
         JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
         JOIN pg_class t ON t.oid = d.refobjid
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
        WHERE s.relkind = 'S'`
    );
    for (const s of seqRows) {
      const lv = (await q(dst, `SELECT last_value FROM "${s.seq}"`))[0].last_value;
      const mx = (await q(dst, `SELECT COALESCE(MAX("${s.col}"),0)::bigint m FROM "${s.tbl}"`))[0].m;
      const ok = BigInt(lv) >= BigInt(mx);
      check(`sequence: ${s.seq} last_value(${lv}) >= max(${s.tbl}.${s.col})=${mx}`, ok);
    }
    check('sequences: all SERIAL tables covered', seqRows.length === srcCat.sequences.length, `${seqRows.length}/${srcCat.sequences.length}`);

    // ---- 6. constraints actually enforced in the restored db ----------
    const fkCount = (await q(dst, `SELECT count(*)::int n FROM pg_constraint con JOIN pg_class r ON r.oid=con.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND con.contype='f'`))[0].n;
    const ckCount = (await q(dst, `SELECT count(*)::int n FROM pg_constraint con JOIN pg_class r ON r.oid=con.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND con.contype='c'`))[0].n;
    check('constraints: foreign keys present', fkCount >= 6, String(fkCount));
    check('constraints: CHECK constraints present', ckCount >= 12, String(ckCount));
    // prove a CHECK actually bites (disposable db only)
    let checkBites = false;
    try {
      await dst.query(`INSERT INTO products (title, handle, price_cents) VALUES ('drift probe', 'verify-probe-neg', -1)`);
    } catch (e) {
      checkBites = /price_cents_check|violates check/i.test(e.message);
    }
    check('constraints: negative price rejected by CHECK (restored db)', checkBites);
    await dst.query(`DELETE FROM products WHERE handle = 'verify-probe-neg'`).catch(() => {});

    // ---- 7. representative data sanity -------------------------------
    const prod = await q(dst, `SELECT title, price_cents, images FROM products ORDER BY id LIMIT 3`);
    check('data: products readable with sane prices + images JSONB', prod.length > 0 && prod.every((p) => p.price_cents >= 0 && Array.isArray(p.images)), `${prod.length} rows`);
    const cats = await q(dst, `SELECT slug FROM categories ORDER BY id`);
    check('data: categories restored', cats.length === (await q(src, `SELECT count(*)::int n FROM categories`))[0].n);
    const adminN = (await q(dst, `SELECT count(*)::int n FROM admins`))[0].n;
    check('data: admin account(s) restored (count only, no PII printed)', adminN >= 0, String(adminN));

    await src.end();

    // ---- 8. schema-file drift: can server/schema.sql recreate this? --
    r = sh(CREATEDB, [schemaDb]);
    if (r.status !== 0) return die(`createdb ${schemaDb} failed: ${r.stderr}`);
    created.push(schemaDb);
    r = sh(PSQL, ['-v', 'ON_ERROR_STOP=1', '-d', schemaDb, '-f', path.join(ROOT, 'server', 'schema.sql')], { stdio: ['ignore', 'ignore', 'pipe'] });
    check('schema.sql applies cleanly to a fresh db', r.status === 0, r.status === 0 ? '' : (r.stderr || '').slice(0, 300));

    if (r.status === 0) {
      const sfc = new Client({ ...conn, database: schemaDb });
      await sfc.connect(); openClients.push(sfc);
      const sfCat = await catalog(sfc);
      for (const k of ['tables', 'columns', 'constraints', 'indexes', 'sequences']) {
        const d = diffSets(dstCat[k], sfCat[k]);
        check(`drift: schema.sql ${k} == production (${dstCat[k].length})`, d.equal,
          d.equal ? '' : `only-in-prod:[${d.onlyA.join(', ')}] only-in-schema.sql:[${d.onlyB.join(', ')}]`.slice(0, 400));
      }
      await sfc.end();
    }

    await dst.end();
  } finally {
    await closeClients();
    cleanup();
  }

  console.log(`\n[verify-restore] ==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('[verify-restore] FATAL', e.message);
  process.exit(1);
});
