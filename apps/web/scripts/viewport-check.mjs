#!/usr/bin/env node
/**
 * Phone / tablet / desktop / wide check for one or more routes (AGENTS.md Definition of Done).
 *
 * Opens each route at each size in headless Chromium (software WebGL so 3D renders), waits for
 * the page to settle, saves a screenshot, and reports page-level horizontal overflow and page
 * errors. Exits 1 when any page overflows or throws, so it can gate a work item.
 *
 *   pnpm --filter @maze/web check:viewports -- play build      (Git Bash: no leading slash)
 *   node scripts/viewport-check.mjs /watch?seed=x --sizes phone,desktop --wait 3000
 *
 * Options:
 *   --base <url>     server to test (default http://127.0.0.1:41920, the always-on dev server)
 *   --sizes <list>   any of phone,tablet,desktop,wide (default all four)
 *   --out <dir>      screenshot folder (default ../../.local/viewport-checks)
 *   --wait <ms>      settle time after load (default 2000)
 *   --prefs <json>   localStorage prefs state, e.g. '{"mode":"2d","speed":100000}'
 *                    (default: light theme, reduced motion, fastest playback)
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SIZES = {
  phone: { width: 390, height: 780, mobile: true },
  tablet: { width: 820, height: 1100, mobile: true },
  desktop: { width: 1280, height: 800, mobile: false },
  wide: { width: 1680, height: 950, mobile: false },
};

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const base = opt('base', 'http://127.0.0.1:41920').replace(/\/$/, '');
const sizes = opt('sizes', 'phone,tablet,desktop,wide')
  .split(',')
  .filter((s) => s in SIZES);
const out = resolve(opt('out', join(here, '..', '..', '..', '.local', 'viewport-checks')));
const wait = Number(opt('wait', '2000'));
const prefs = JSON.parse(opt('prefs', '{"theme":"light","reducedMotion":"on","speed":100000}'));
// Git Bash rewrites "/build" into "C:/Program Files/Git/build"; undo that (or pass "build").
const unmangle = (r) => r.replace(/^[a-z]:[/\\].*?[/\\]git[/\\]/i, '/');
const given = args.filter((a) => a !== '--').map(unmangle);
const routes = given.length > 0 ? given : ['/'];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
let failures = 0;
for (const route of routes) {
  for (const size of sizes) {
    const s = SIZES[size];
    const ctx = await browser.newContext({
      viewport: { width: s.width, height: s.height },
      hasTouch: s.mobile,
      isMobile: s.mobile && s.width < 500,
    });
    await ctx.addInitScript(
      (p) => localStorage.setItem('maze-lab:prefs', JSON.stringify({ state: p, version: 1 })),
      prefs,
    );
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}${route.startsWith('/') ? route : `/${route}`}`);
    await page.waitForTimeout(wait);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    // A mistyped route renders the not-found page, which would otherwise "pass".
    if (await page.getByRole('heading', { name: /page not found/i }).count()) {
      errors.push('route not found');
    }
    const file = join(
      out,
      `${route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}-${size}.png`,
    );
    await page.screenshot({ path: file });
    const ok = overflow <= 0 && errors.length === 0;
    if (!ok) failures++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${route} ${size} ${String(s.width)}px overflow=${String(overflow)} errors=${String(errors.length)}${errors[0] ? ` (${errors[0].slice(0, 120)})` : ''} -> ${file}`,
    );
    await ctx.close();
  }
}
await browser.close();
process.exit(failures > 0 ? 1 : 0);
