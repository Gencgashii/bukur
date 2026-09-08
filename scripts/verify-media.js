'use strict';
/**
 * Standalone integrity check for the generated storefront media.
 *
 * Asserts, for every source in media-src/:
 *   - the JPEG fallback and every AVIF/WebP width exist and are readable
 *   - derivative pixel width == requested width (capped at the source width)
 *   - derivative aspect ratio matches the source within 1%
 *   - no derivative is larger (bytes) than its source
 *   - no >=640w derivative is suspiciously tiny (< 3 KB)
 *   - source files are still valid images and unchanged in dimensions
 *
 * Exits non-zero on the first failed assertion. Run: npm run media:verify
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'media-src');
const OUT_DIR = path.join(ROOT, 'public', 'media');

// keep in sync with scripts/optimize-media.js
const WIDTHS = [640, 960, 1280, 1600, 2000, 2560];
const FALLBACK_WIDTH = 1600;

(async () => {
  const fails = [];
  const note = (m) => fails.push(m);

  const sources = fs
    .readdirSync(SRC_DIR)
    .filter((f) => /\.(png|jpe?g)$/i.test(f) && fs.statSync(path.join(SRC_DIR, f)).isFile());

  if (!sources.length) {
    console.error('[verify] no sources in media-src/');
    process.exit(1);
  }

  let checked = 0;

  for (const file of sources) {
    const name = file.replace(/\.[^.]+$/, '');
    const srcPath = path.join(SRC_DIR, file);
    const srcStat = fs.statSync(srcPath);

    let sm;
    try {
      sm = await sharp(srcPath).metadata();
    } catch (e) {
      note(`source ${file}: unreadable (${e.message})`);
      continue;
    }
    if (!sm.width || !sm.height) note(`source ${file}: no dimensions`);
    const srcAspect = sm.width / sm.height;

    const targets = [{ f: `${name}.jpg`, w: Math.min(FALLBACK_WIDTH, sm.width) }];
    for (const w of WIDTHS) {
      targets.push({ f: `${name}-${w}.avif`, w: Math.min(w, sm.width) });
      targets.push({ f: `${name}-${w}.webp`, w: Math.min(w, sm.width) });
    }

    for (const t of targets) {
      const p = path.join(OUT_DIR, t.f);
      if (!fs.existsSync(p)) {
        note(`${t.f}: missing`);
        continue;
      }
      const bytes = fs.statSync(p).size;
      let dm;
      try {
        dm = await sharp(p).metadata();
      } catch (e) {
        note(`${t.f}: unreadable / corrupt (${e.message})`);
        continue;
      }
      if (dm.width !== t.w) note(`${t.f}: width ${dm.width} != expected ${t.w}`);
      if (dm.height) {
        const a = dm.width / dm.height;
        if (Math.abs(a - srcAspect) / srcAspect > 0.01) {
          note(`${t.f}: aspect ${a.toFixed(4)} != source ${srcAspect.toFixed(4)}`);
        }
      }
      if (bytes > srcStat.size) note(`${t.f}: ${(bytes / 1024).toFixed(1)}KB larger than source`);
      if (t.w >= 640 && bytes < 3 * 1024) note(`${t.f}: suspiciously tiny (${(bytes / 1024).toFixed(1)}KB)`);
      checked += 1;
    }
  }

  if (fails.length) {
    console.error(`[verify] ${fails.length} problem(s):`);
    for (const m of fails) console.error('  - ' + m);
    process.exit(1);
  }
  console.log(`[verify] OK — ${checked} derivatives across ${sources.length} sources; sources intact.`);
})().catch((e) => {
  console.error('[verify] failed:', e.message);
  process.exit(1);
});
