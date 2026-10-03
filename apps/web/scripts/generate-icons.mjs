#!/usr/bin/env node
/**
 * Generates the PWA icons from the same maze glyph as public/favicon.svg, with no native
 * dependencies: shapes are rasterised into an RGBA buffer (2x2 supersampling) and written as
 * PNG using zlib for the IDAT stream.
 *
 *   node scripts/generate-icons.mjs        (run from apps/web; output in public/)
 *
 * Outputs: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, public/apple-touch-icon.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');

// ---- palette (matches favicon.svg and the app tokens) -----------------------------------
const BG = [0x71, 0xad, 0xf5]; // brand blue
const INK = [0x0f, 0x14, 0x20]; // dark navy (walls)
const GOAL = [0x41, 0x75, 0x05]; // cell green

// ---- glyph in a 32x32 viewBox: stroked polylines + one filled circle --------------------
const STROKE = 2.5;
const SEGMENTS = [
  [6, 6, 26, 6],
  [6, 6, 6, 26],
  [26, 6, 26, 14],
  [6, 26, 18, 26],
  [12, 12, 20, 12],
  [20, 12, 20, 20],
  [20, 20, 12, 20],
  [18, 12, 18, 10],
  [12, 20, 12, 26],
  [22, 26, 26, 26],
  [26, 26, 26, 18],
  [26, 18, 22, 18],
];
const CIRCLE = { cx: 23, cy: 23, r: 2.2 };

function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x0 + t * dx;
  const qy = y0 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** Coverage of the glyph (0..1) at a point in viewBox units: 0 = background, 1 = ink. */
function glyphAt(x, y) {
  const half = STROKE / 2;
  for (const [x0, y0, x1, y1] of SEGMENTS) {
    if (distToSegment(x, y, x0, y0, x1, y1) <= half) return 'ink';
  }
  if (Math.hypot(x - CIRCLE.cx, y - CIRCLE.cy) <= CIRCLE.r) return 'goal';
  return null;
}

function insideRoundedRect(x, y, size, radius) {
  const r = radius;
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

/**
 * Rasterise one icon.
 * @param size pixel size
 * @param opts.maskable full-bleed background (no transparent corners) and the glyph scaled
 *   into the central 60 % so it survives any platform mask (safe zone is the inner 80 %).
 */
function rasterise(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 2; // supersampling per axis
  const glyphScale = maskable ? 0.6 : 0.82; // fraction of the icon the 32-unit glyph spans
  const glyphPx = size * glyphScale;
  const offset = (size - glyphPx) / 2;
  const cornerRadius = maskable ? 0 : size * (6 / 32);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          let col = null;
          if (maskable || insideRoundedRect(x, y, size, cornerRadius)) {
            col = BG;
            const gx = ((x - offset) / glyphPx) * 32;
            const gy = ((y - offset) / glyphPx) * 32;
            const g = glyphAt(gx, gy);
            if (g === 'ink') col = INK;
            else if (g === 'goal') col = GOAL;
          }
          if (col) {
            acc[0] += col[0];
            acc[1] += col[1];
            acc[2] += col[2];
            acc[3] += 255;
          }
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      const alpha = acc[3] / n;
      // Straight (non-premultiplied) colour: average only over covered samples.
      const covered = acc[3] / 255 || 1;
      rgba[i] = Math.round(acc[0] / covered);
      rgba[i + 1] = Math.round(acc[1] / covered);
      rgba[i + 2] = Math.round(acc[2] / covered);
      rgba[i + 3] = Math.round(alpha);
    }
  }
  return rgba;
}

// ---- minimal PNG encoder ----------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(rgba, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // One filter byte (0 = None) per scanline.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function write(relPath, size, opts) {
  const file = join(publicDir, relPath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(rasterise(size, opts), size));
  console.log(`wrote ${relPath} (${size}x${size})`);
}

write('icons/icon-192.png', 192, { maskable: false });
write('icons/icon-512.png', 512, { maskable: false });
write('icons/icon-maskable-512.png', 512, { maskable: true });
write('apple-touch-icon.png', 180, { maskable: true });
