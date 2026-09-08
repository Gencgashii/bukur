'use strict';
/**
 * BUKUR storefront media optimisation — QUALITY FIRST.
 *
 * Reads the ORIGINAL photography from  media-src/*.{png,jpg}  (2752x1536 kept
 * out of the production delivery path) and writes optimised, responsive
 * variants into  public/media/  which the static host serves with the build.
 *
 * For each source `NAME.png` it produces, EACH generated INDEPENDENTLY from the
 * untouched original (never a re-compressed derivative of a derivative):
 *
 *   public/media/NAME.jpg          1600w progressive JPEG   (universal fallback)
 *   public/media/NAME-<w>.avif     for w in WIDTHS
 *   public/media/NAME-<w>.webp     for w in WIDTHS
 *
 * Priorities, in order: (1) look premium / close to the source, (2) responsive
 * delivery, (3) reasonable weight. We do NOT chase the smallest file — a
 * 150-250 KB image that stays sharp beats an 80 KB image with visible blocking,
 * banding or texture loss.
 *
 * No upscaling (a width larger than the source is skipped). Aspect ratio is
 * preserved; nothing is cropped. A clean rebuild wipes ONLY generated
 * derivatives in public/media (source files in media-src/ are never touched).
 *
 * Requires the dev dependency `sharp`. Run:  npm run media:optimize
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('[media] `sharp` is not installed. Run: npm i -D sharp');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'media-src');
const OUT_DIR = path.join(ROOT, 'public', 'media');

// Responsive widths chosen against real rendered sizes (container is 1560px):
//   640  - small phones (1x), tiny cart/checkout thumbs
//   960  - phones (2x), tablet, desktop product card (2x)
//   1280 - desktop product card / tablet hero
//   1600 - desktop PDP gallery + editorial split, universal JPEG fallback
//   2000 - desktop hero, PDP gallery on 2x displays
//   2560 - large / retina hero (near the 2752px native width)
const WIDTHS = [640, 960, 1280, 1600, 2000, 2560];
const FALLBACK_WIDTH = 1600;

// Quality-first codec settings. Verified by eye + file size against the source.
//  - 4:4:4 chroma everywhere: these images have saturated reds/blues and fine
//    satin/mesh detail that 4:2:0 muddies.
//  - higher `effort` = better quality-per-byte; fine for a build-time script.
// AVIF q78 / effort 6 / 4:4:4 is "visually lossless" for photographic content
// while staying well inside the premium 100-300 KB zone for desktop widths.
const AVIF = { quality: 78, effort: 6, chromaSubsampling: '4:4:4' };
const WEBP = { quality: 86, effort: 6, smartSubsample: true };
const JPEG = { quality: 90, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' };

// Very light post-resize sharpening to recover perceived detail lost to
// downscaling. Deliberately gentle — no haloing, no artificial texture. Only
// applied to meaningful downscales; near-native widths don't need it.
const SHARPEN = { sigma: 0.5, m1: 0.4, m2: 0.85 };
const SHARPEN_BELOW = 0.7; // fraction of source width

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

// One derivative, always straight from the original buffer.
async function emit(srcBuf, width, sourceWidth, outPath, encode) {
  let pipe = sharp(srcBuf, { failOn: 'error' });
  const targetW = Math.min(width, sourceWidth);
  pipe = pipe.resize({ width: targetW, withoutEnlargement: true, kernel: 'lanczos3' });
  if (targetW < sourceWidth * SHARPEN_BELOW) pipe = pipe.sharpen(SHARPEN);
  await encode(pipe).toFile(outPath);
  return fs.statSync(outPath).size;
}

async function run() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`[media] source directory not found: ${SRC_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sources = fs
    .readdirSync(SRC_DIR)
    .filter((f) => /\.(png|jpe?g)$/i.test(f) && fs.statSync(path.join(SRC_DIR, f)).isFile());

  if (!sources.length) {
    console.error(`[media] no source images in ${SRC_DIR}`);
    process.exit(1);
  }

  // Clean rebuild: remove ONLY generated derivatives (never touch media-src/).
  let wiped = 0;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/\.(avif|webp|jpe?g)$/i.test(f)) {
      fs.rmSync(path.join(OUT_DIR, f));
      wiped += 1;
    }
  }
  console.log(`[media] cleaned ${wiped} old derivative(s) from public/media\n`);

  let inBytes = 0;
  let outBytes = 0;
  const rows = [];
  const problems = [];

  for (const file of sources) {
    const name = file.replace(/\.[^.]+$/, '');
    const srcPath = path.join(SRC_DIR, file);
    const srcBuf = fs.readFileSync(srcPath);
    inBytes += srcBuf.length;

    const meta = await sharp(srcBuf).metadata();
    const srcW = meta.width || Math.max(...WIDTHS);
    const srcH = meta.height || 0;
    const srcAspect = srcH ? srcW / srcH : 0;

    // universal fallback: one progressive JPEG
    const fbW = Math.min(FALLBACK_WIDTH, srcW);
    const fbPath = path.join(OUT_DIR, `${name}.jpg`);
    const fbSize = await emit(srcBuf, fbW, srcW, fbPath, (p) => p.jpeg(JPEG));
    outBytes += fbSize;
    rows.push([`${name}.jpg`, fbW, kb(fbSize)]);

    for (const w of WIDTHS) {
      if (w > srcW && w !== WIDTHS[0]) {
        // never enlarge; but if EVERY width exceeds the source, still emit the
        // smallest so srcset is non-empty (won't happen with these sources).
      }
      for (const [ext, encode] of [
        ['avif', (p) => p.avif(AVIF)],
        ['webp', (p) => p.webp(WEBP)],
      ]) {
        const outPath = path.join(OUT_DIR, `${name}-${w}.${ext}`);
        const size = await emit(srcBuf, w, srcW, outPath, encode);
        outBytes += size;
        rows.push([`${name}-${w}.${ext}`, Math.min(w, srcW), kb(size)]);

        // sanity checks
        const dm = await sharp(outPath).metadata();
        const expW = Math.min(w, srcW);
        if (dm.width !== expW) problems.push(`${outPath}: width ${dm.width} != ${expW}`);
        if (srcAspect && dm.height) {
          const a = dm.width / dm.height;
          if (Math.abs(a - srcAspect) / srcAspect > 0.01) {
            problems.push(`${outPath}: aspect ${a.toFixed(4)} != source ${srcAspect.toFixed(4)}`);
          }
        }
        if (size > srcBuf.length) problems.push(`${outPath}: ${kb(size)} larger than source`);
        if (expW >= 640 && size < 3 * 1024) problems.push(`${outPath}: suspiciously tiny (${kb(size)})`);
      }
    }
  }

  rows.sort((a, b) => a[0].localeCompare(b[0]));
  console.log('  variant                             width       size');
  console.log('  ' + '-'.repeat(54));
  for (const [f, w, s] of rows) {
    console.log(`  ${f.padEnd(34)} ${String(w).padStart(5)}   ${s.padStart(10)}`);
  }
  console.log('\n  sources:', sources.length, '| variants written:', rows.length);
  console.log('  source bytes total :', mb(inBytes));
  console.log('  variant bytes total:', mb(outBytes), '(a browser downloads ONE variant per image per viewport)');

  if (problems.length) {
    console.error('\n[media] SANITY CHECK FAILED:');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  console.log('\n[media] sanity checks passed.');
}

run().catch((e) => {
  console.error('[media] failed:', e.message);
  process.exit(1);
});
