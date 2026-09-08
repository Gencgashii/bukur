'use strict';
/**
 * Re-point seeded storefront product image URLs from the original PNG names to
 * the optimised JPEG fallback names:  /media/<slug>.png  ->  /media/<slug>.jpg
 *
 * The responsive AVIF/WebP variants are resolved by the <Img> component from
 * the same slug, so the stored URL only needs to be a valid fallback path.
 *
 * NON-DESTRUCTIVE: updates data values only. No schema change, no DELETE.
 * Idempotent — only rows whose URLs still point at "/media/<slug>.png" change.
 * Admin-uploaded images (/uploads/... or external hosts) are left untouched.
 *
 * Run:  node scripts/reindex-product-media.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { Client } = require(path.join(ROOT, 'node_modules', 'pg'));

const MEDIA_PNG = /^\/media\/([a-z0-9-]+)\.png$/i;
const repoint = (url) => {
  const m = typeof url === 'string' && url.match(MEDIA_PNG);
  return m ? `/media/${m[1]}.jpg` : url;
};

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const rows = (await c.query('SELECT id, image_url, images FROM products')).rows;
  let changed = 0;

  for (const r of rows) {
    const newImageUrl = repoint(r.image_url);
    const imgs = Array.isArray(r.images) ? r.images : [];
    const newImages = imgs.map((im, i) => ({
      url: repoint(typeof im === 'string' ? im : im && im.url),
      position: Number.isFinite(Number(im && im.position)) ? Number(im.position) : i,
    }));
    const imagesChanged = JSON.stringify(newImages) !== JSON.stringify(imgs);

    if (newImageUrl !== r.image_url || imagesChanged) {
      await c.query(
        'UPDATE products SET image_url = $1, images = $2::jsonb, updated_at = NOW() WHERE id = $3',
        [newImageUrl, JSON.stringify(newImages), r.id]
      );
      changed += 1;
      console.log(`  product ${r.id}: ${r.image_url} -> ${newImageUrl}`);
    }
  }

  console.log(`\n  ${changed} product row(s) re-pointed, ${rows.length - changed} already current.`);
  await c.end();
})().catch((e) => {
  console.error('reindex failed:', e.message);
  process.exit(1);
});
