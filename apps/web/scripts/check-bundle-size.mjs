#!/usr/bin/env node
/**
 * Bundle-size gate (proj-mgmt/03 section 12): fails when the JavaScript needed for the
 * initial route exceeds the gzip budget, or when a named lazy chunk (three.js) outgrows its
 * own budget. Reads Vite's build manifest (`build.manifest: true`).
 *
 * Runs automatically as `postbuild`; skips gracefully when there is no dist/ yet.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const distDir = join(appDir, 'dist');
const manifestPath = join(distDir, '.vite', 'manifest.json');
const budgetPath = join(appDir, 'size-budget.json');

if (!existsSync(manifestPath)) {
  console.log('[size] no dist/.vite/manifest.json found; skipping bundle-size check');
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
const KB = 1024;

const sizeCache = new Map();
function sizes(file) {
  if (!sizeCache.has(file)) {
    const full = join(distDir, file);
    const buf = readFileSync(full);
    sizeCache.set(file, { raw: statSync(full).size, gzip: gzipSync(buf, { level: 9 }).length });
  }
  return sizeCache.get(file);
}

// ---- initial graph: entry chunks plus everything they import statically -----------------
const entries = Object.entries(manifest).filter(([, m]) => m.isEntry);
const initialKeys = new Set();
const initialCss = new Set();
const stack = entries.map(([k]) => k);
while (stack.length) {
  const key = stack.pop();
  if (initialKeys.has(key)) continue;
  const m = manifest[key];
  if (!m) continue;
  initialKeys.add(key);
  for (const css of m.css ?? []) initialCss.add(css);
  for (const dep of m.imports ?? []) stack.push(dep);
}

const rows = [];
let initialJsGzip = 0;
let initialJsRaw = 0;
for (const key of initialKeys) {
  const m = manifest[key];
  if (!m.file.endsWith('.js')) continue;
  const s = sizes(m.file);
  initialJsGzip += s.gzip;
  initialJsRaw += s.raw;
  rows.push({ kind: 'initial', file: m.file, rawKb: +(s.raw / KB).toFixed(1), gzipKb: +(s.gzip / KB).toFixed(1) });
}
let initialCssGzip = 0;
for (const css of initialCss) {
  const s = sizes(css);
  initialCssGzip += s.gzip;
  rows.push({ kind: 'css', file: css, rawKb: +(s.raw / KB).toFixed(1), gzipKb: +(s.gzip / KB).toFixed(1) });
}

// ---- lazy chunks ---------------------------------------------------------------------------
const lazy = Object.entries(manifest).filter(([k, m]) => !initialKeys.has(k) && m.file.endsWith('.js'));
for (const [, m] of lazy) {
  const s = sizes(m.file);
  rows.push({ kind: 'lazy', file: m.file, rawKb: +(s.raw / KB).toFixed(1), gzipKb: +(s.gzip / KB).toFixed(1) });
}

rows.sort((a, b) => b.gzipKb - a.gzipKb);
console.table(rows);
console.log(
  `[size] initial JS: ${(initialJsRaw / KB).toFixed(1)} kB raw, ${(initialJsGzip / KB).toFixed(1)} kB gzip (budget ${budget.initialJsGzipKb} kB gzip); initial CSS: ${(initialCssGzip / KB).toFixed(1)} kB gzip (budget ${budget.initialCssGzipKb} kB)`,
);

const failures = [];
if (initialJsGzip > budget.initialJsGzipKb * KB) {
  failures.push(`initial JS ${(initialJsGzip / KB).toFixed(1)} kB gzip exceeds ${budget.initialJsGzipKb} kB`);
}
if (initialCssGzip > budget.initialCssGzipKb * KB) {
  failures.push(`initial CSS ${(initialCssGzip / KB).toFixed(1)} kB gzip exceeds ${budget.initialCssGzipKb} kB`);
}
for (const [name, limits] of Object.entries(budget.lazyChunks ?? {})) {
  const match = lazy.find(([, m]) => m.file.includes(`/${name}-`) || m.file.includes(`/${name}.`));
  if (!match) {
    failures.push(`expected a lazy chunk named '${name}' (is three.js still loaded through import()?)`);
    continue;
  }
  const s = sizes(match[1].file);
  if (limits.rawKb && s.raw > limits.rawKb * KB) {
    failures.push(`${name} chunk ${(s.raw / KB).toFixed(1)} kB raw exceeds ${limits.rawKb} kB`);
  }
  if (limits.gzipKb && s.gzip > limits.gzipKb * KB) {
    failures.push(`${name} chunk ${(s.gzip / KB).toFixed(1)} kB gzip exceeds ${limits.gzipKb} kB`);
  }
  if (initialKeys.has(match[0])) failures.push(`${name} chunk is part of the initial graph`);
}

if (failures.length) {
  console.error('[size] budget exceeded:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('[size] within budget');
