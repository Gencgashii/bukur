'use strict';

/**
 * Unit tests for the media storage abstraction (server/lib/storage.js).
 *
 * NO real cloud credentials and NO network: the S3 driver talks to an
 * S3-compatible HTTP API via aws4fetch, which calls the global `fetch`. Each
 * test swaps in a fake `fetch` that records the signed Request and returns a
 * scripted Response.
 *
 * Run:  node --test server/tests/storage.test.js
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-used-for-anything-real-0123456789';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const storage = require('../lib/storage');
const { getStorage, makeS3Storage, readS3Config, assertOwnedKey, _resetStorageForTests, uploadDir, MEDIA_PREFIX } =
  storage;

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=',
  'base64'
);

const S3_ENV = {
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'bukur-media',
  S3_REGION: 'auto',
  S3_ACCESS_KEY_ID: 'AKIA_TEST_ONLY',
  S3_SECRET_ACCESS_KEY: 'secret_test_only_do_not_use',
  S3_PUBLIC_BASE_URL: 'https://cdn.bukur.example/media',
};
const S3_KEYS = [
  'STORAGE_DRIVER', 'S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
  'S3_PUBLIC_BASE_URL', 'S3_ENDPOINT', 'S3_FORCE_PATH_STYLE', 'MEDIA_PUBLIC_BASE_URL',
];

function snapshotEnv() {
  const snap = {};
  for (const k of S3_KEYS) snap[k] = process.env[k];
  return snap;
}
function restoreEnv(snap) {
  for (const k of S3_KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}
function setEnv(obj) {
  for (const k of S3_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) process.env[k] = v;
  }
}

/** Install a fake global.fetch. `handler(request)` -> {status, body?} or throws. */
function fakeFetch(handler) {
  const calls = [];
  const real = global.fetch;
  global.fetch = async (input, init) => {
    // aws4fetch passes a Request; be tolerant of (url, init) too.
    let req = input;
    if (!(input && typeof input === 'object' && 'method' in input && 'url' in input)) {
      req = new Request(String(input), init);
    }
    const bodyBuf = Buffer.from(await req.clone().arrayBuffer());
    const rec = {
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body: bodyBuf,
    };
    calls.push(rec);
    const out = await handler(rec);
    if (out instanceof Error) throw out;
    const { status = 200, body } = out || {};
    // 204/205/304 must have a null body per the Response contract.
    const nullBody = status === 204 || status === 205 || status === 304;
    return new Response(nullBody ? null : body == null ? '' : body, { status });
  };
  return {
    calls,
    restore() {
      global.fetch = real;
    },
  };
}

async function withS3(overrides, handler, fn) {
  const snap = snapshotEnv();
  setEnv({ ...S3_ENV, ...overrides });
  _resetStorageForTests();
  const ff = handler ? fakeFetch(handler) : null;
  try {
    return await fn(ff);
  } finally {
    if (ff) ff.restore();
    _resetStorageForTests();
    restoreEnv(snap);
  }
}

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------
test('config: full S3 env is accepted', async () => {
  await withS3({}, null, () => {
    const cfg = readS3Config();
    assert.equal(cfg.bucket, 'bukur-media');
    assert.equal(cfg.region, 'auto');
    assert.equal(cfg.publicBaseUrl, 'https://cdn.bukur.example/media');
    const s = getStorage();
    assert.equal(s.driver, 's3');
  });
});

for (const missing of ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL']) {
  test(`config: missing ${missing} fails closed`, async () => {
    await withS3({ [missing]: undefined }, null, () => {
      assert.throws(
        () => getStorage(),
        (e) =>
          e.code === 'storage_not_configured' &&
          e.status === 500 &&
          Array.isArray(e.details?.missingEnv) &&
          e.details.missingEnv.includes(missing)
      );
    });
  });
}

test('config: STORAGE_DRIVER=s3 never silently falls back to local', async () => {
  await withS3({ S3_BUCKET: undefined, S3_REGION: undefined }, null, () => {
    setEnv({ STORAGE_DRIVER: 's3' }); // nothing else
    _resetStorageForTests();
    assert.throws(
      () => getStorage(),
      (e) => e.code === 'storage_not_configured' && e.details?.missingEnv?.length === 5
    );
    // and it must NOT have returned a local driver
    _resetStorageForTests();
    let fellBack = false;
    try {
      fellBack = getStorage().driver === 'local';
    } catch {
      /* expected */
    }
    assert.equal(fellBack, false, 's3 misconfig must never yield a local driver');
  });
});

test('config: unknown STORAGE_DRIVER is rejected', async () => {
  await withS3({ STORAGE_DRIVER: 'dropbox' }, null, () => {
    assert.throws(() => getStorage(), (e) => e.code === 'storage_not_configured' && /Unknown STORAGE_DRIVER/.test(e.message));
  });
});

// ---------------------------------------------------------------------------
// UPLOAD (save)
// ---------------------------------------------------------------------------
test('save: successful PUT returns a namespaced key + public URL', async () => {
  await withS3({}, () => ({ status: 200 }), async (ff) => {
    const s = getStorage();
    const { key, url } = await s.save({ buffer: PNG, mime: 'image/png' });

    assert.match(key, /^products\/[0-9a-f-]{36}\.png$/);
    assert.equal(url, `https://cdn.bukur.example/media/${key}`);

    assert.equal(ff.calls.length, 1);
    const c = ff.calls[0];
    assert.equal(c.method, 'PUT');
    // signed against the bucket virtual-host (no endpoint set)
    assert.equal(c.url, `https://bukur-media.s3.auto.amazonaws.com/${key}`);
    assert.equal(c.headers['content-type'], 'image/png');
    assert.equal(c.headers['x-amz-content-sha256'], require('crypto').createHash('sha256').update(PNG).digest('hex'));
    assert.ok(c.body.equals(PNG), 'request body is the uploaded bytes');
    assert.match(c.headers['authorization'] || '', /^AWS4-HMAC-SHA256 Credential=AKIA_TEST_ONLY\//);
  });
});

test('save: object key is server-generated, unique, and inside products/', async () => {
  await withS3({}, () => ({ status: 200 }), async () => {
    const s = getStorage();
    const a = await s.save({ buffer: PNG, mime: 'image/png' });
    const b = await s.save({ buffer: PNG, mime: 'image/png' });
    assert.notEqual(a.key, b.key);
    assert.ok(a.key.startsWith(MEDIA_PREFIX) && b.key.startsWith(MEDIA_PREFIX));
  });
});

test('save: custom endpoint (R2-style) uses path-style signed URL', async () => {
  await withS3(
    { S3_ENDPOINT: 'https://acct123.r2.cloudflarestorage.com', S3_REGION: 'auto' },
    () => ({ status: 200 }),
    async (ff) => {
      const s = getStorage();
      const { key } = await s.save({ buffer: PNG, mime: 'image/webp' });
      assert.equal(ff.calls[0].url, `https://acct123.r2.cloudflarestorage.com/bukur-media/${key}`);
      assert.match(key, /\.webp$/);
    }
  );
});

test('save: unsupported mime rejected before any network call', async () => {
  await withS3({}, () => ({ status: 200 }), async (ff) => {
    const s = getStorage();
    await assert.rejects(s.save({ buffer: PNG, mime: 'image/svg+xml' }), (e) => e.code === 'unsupported_file_type');
    assert.equal(ff.calls.length, 0);
  });
});

test('save: empty buffer rejected before any network call', async () => {
  await withS3({}, () => ({ status: 200 }), async (ff) => {
    const s = getStorage();
    await assert.rejects(s.save({ buffer: Buffer.alloc(0), mime: 'image/png' }), (e) => e.code === 'empty_file');
    assert.equal(ff.calls.length, 0);
  });
});

test('save: storage rejects upload (HTTP 403) -> storage_write_failed, no success', async () => {
  await withS3({}, () => ({ status: 403, body: '<Error>AccessDenied</Error>' }), async () => {
    const s = getStorage();
    await assert.rejects(
      s.save({ buffer: PNG, mime: 'image/png' }),
      (e) => e.code === 'storage_write_failed' && e.status === 502
    );
  });
});

test('save: network failure -> storage_write_failed (no unhandled throw)', async () => {
  await withS3({}, () => new Error('ECONNREFUSED'), async () => {
    const s = getStorage();
    await assert.rejects(
      s.save({ buffer: PNG, mime: 'image/png' }),
      (e) => e.code === 'storage_write_failed' && e.status === 502
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE (remove)
// ---------------------------------------------------------------------------
test('remove: successful DELETE (204) resolves', async () => {
  await withS3({}, () => ({ status: 204 }), async (ff) => {
    const s = getStorage();
    await s.remove('products/abc.png');
    assert.equal(ff.calls[0].method, 'DELETE');
    assert.equal(ff.calls[0].url, 'https://bukur-media.s3.auto.amazonaws.com/products/abc.png');
  });
});

test('remove: missing object (404) is not an error (idempotent)', async () => {
  await withS3({}, () => ({ status: 404 }), async () => {
    const s = getStorage();
    await assert.doesNotReject(s.remove('products/gone.png'));
  });
});

test('remove: hard failure (403) -> storage_delete_failed', async () => {
  await withS3({}, () => ({ status: 403 }), async () => {
    const s = getStorage();
    await assert.rejects(s.remove('products/x.png'), (e) => e.code === 'storage_delete_failed' && e.status === 502);
  });
});

test('remove: refuses keys outside the products/ namespace, no network call', async () => {
  const isInvalidKey = (e) => e.code === 'invalid_key' && e.status === 400;
  await withS3({}, () => ({ status: 204 }), async (ff) => {
    const s = getStorage();
    for (const bad of ['secrets/app.env', 'config.json', '', 'products/', '../products/x.png', 'products/../../etc/passwd', 'products//x.png']) {
      await assert.rejects(s.remove(bad), isInvalidKey, `should reject: ${JSON.stringify(bad)}`);
    }
    assert.equal(ff.calls.length, 0, 'no DELETE was ever sent for a bad key');
  });
});

test('assertOwnedKey: accepts only well-formed products/ keys', () => {
  const isInvalidKey = (e) => e.code === 'invalid_key';
  assert.equal(assertOwnedKey('products/1a2b.png'), 'products/1a2b.png');
  assert.throws(() => assertOwnedKey('products/'), isInvalidKey);
  assert.throws(() => assertOwnedKey('other/1.png'), isInvalidKey);
  assert.throws(() => assertOwnedKey('products/a b.png'), isInvalidKey);
});

// ---------------------------------------------------------------------------
// PUBLIC URL
// ---------------------------------------------------------------------------
test('publicUrl: built from S3_PUBLIC_BASE_URL, never contains credentials', async () => {
  await withS3({ S3_PUBLIC_BASE_URL: 'https://img.bukurworld.com' }, null, () => {
    const s = makeS3Storage();
    const u = s.publicUrl('products/pic.avif');
    assert.equal(u, 'https://img.bukurworld.com/products/pic.avif');
    assert.doesNotMatch(u, /AKIA_TEST_ONLY|secret_test_only/);
  });
});

test('publicUrl + save url: no access key or secret leaks into any returned URL', async () => {
  await withS3({}, () => ({ status: 200 }), async () => {
    const s = getStorage();
    const { url } = await s.save({ buffer: PNG, mime: 'image/png' });
    assert.doesNotMatch(url, /AKIA_TEST_ONLY/);
    assert.doesNotMatch(url, /secret_test_only/);
    assert.doesNotMatch(url, /X-Amz-Signature|Authorization/i);
  });
});

// ---------------------------------------------------------------------------
// LOCAL DRIVER — unchanged behaviour still works
// ---------------------------------------------------------------------------
test('local: default driver writes a flat uuid key under public/uploads', async () => {
  const snap = snapshotEnv();
  setEnv({}); // no STORAGE_DRIVER -> local
  _resetStorageForTests();
  try {
    const s = getStorage();
    assert.equal(s.driver, 'local');
    const { key, url } = await s.save({ buffer: PNG, mime: 'image/png' });
    assert.match(key, /^[0-9a-f-]{36}\.png$/); // NOT namespaced — local dev unchanged
    assert.equal(url, `/uploads/${key}`);
    assert.ok(fs.existsSync(path.join(uploadDir, key)), 'file written to disk');
    await s.remove(key);
    assert.ok(!fs.existsSync(path.join(uploadDir, key)), 'file removed');
  } finally {
    _resetStorageForTests();
    restoreEnv(snap);
  }
});

test('local: remove ignores traversal keys (no delete outside uploadDir)', async () => {
  const snap = snapshotEnv();
  setEnv({});
  _resetStorageForTests();
  try {
    const s = getStorage();
    // a key that is not a bare basename is a no-op, never a traversal
    await assert.doesNotReject(s.remove('../../server/index.js'));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'index.js')), 'unrelated file untouched');
  } finally {
    _resetStorageForTests();
    restoreEnv(snap);
  }
});
