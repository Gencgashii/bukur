'use strict';

/**
 * Minimal image content sniffing by magic bytes — no dependency.
 *
 * The upload route already restricts by declared MIME (multer fileFilter) and
 * by extension (storage layer). This adds a third, content-based check so a
 * renamed script / HTML / SVG / spoofed MIME cannot slip through: we read the
 * first bytes of the buffer and only accept it when the real container is one
 * of the raster image types we serve.
 *
 *   sniffImageMime(buffer) -> 'image/jpeg' | 'image/png' | 'image/webp'
 *                             | 'image/gif' | 'image/avif' | null
 *
 * SVG is intentionally NOT recognised (it is XML/markup, an XSS vector) and
 * neither is anything else.
 */

const ASCII = (buf, start, text) => {
  if (buf.length < start + text.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (buf[start + i] !== text.charCodeAt(i)) return false;
  }
  return true;
};

function sniffImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: "GIF87a" or "GIF89a"
  if (ASCII(buffer, 0, 'GIF87a') || ASCII(buffer, 0, 'GIF89a')) return 'image/gif';

  // RIFF container: "RIFF" .... "WEBP"
  if (ASCII(buffer, 0, 'RIFF') && ASCII(buffer, 8, 'WEBP')) return 'image/webp';

  // ISO-BMFF (AVIF): bytes 4-8 = "ftyp", brand at 8-12 among avif / avis / mif1 / miaf
  if (ASCII(buffer, 4, 'ftyp')) {
    const brand = buffer.toString('latin1', 8, 12);
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1' || brand === 'miaf') {
      return 'image/avif';
    }
  }

  return null;
}

module.exports = { sniffImageMime };
