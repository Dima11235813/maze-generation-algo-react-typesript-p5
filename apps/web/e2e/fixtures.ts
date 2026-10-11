/**
 * Shared Playwright fixtures.
 *
 * Every page seeds `localStorage['maze-lab:prefs']` once (only when absent, so tests that
 * check persistence still see their own writes) with reduced motion on and the fastest
 * playback speed. That makes generation/solve effectively instantaneous and deterministic.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test';

export const PREFS_KEY = 'maze-lab:prefs';
export const LIBRARY_KEY = 'maze-lab:library';

const SEEDED_PREFS = {
  state: { reducedMotion: 'on', speed: 100_000, theme: 'light' },
  version: 1,
} as const;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(
      ({ key, value }) => {
        try {
          if (window.localStorage.getItem(key) === null) {
            window.localStorage.setItem(key, JSON.stringify(value));
          }
        } catch {
          /* storage blocked: the app falls back to defaults */
        }
      },
      { key: PREFS_KEY, value: SEEDED_PREFS },
    );
    await use(page);
  },
});

export { expect };

/** The Play page's canvas host; its accessible name reports grid size and phase. */
export function canvasHost(page: Page): Locator {
  return page.getByRole('img', { name: /^Maze canvas/ });
}

export function toolbar(page: Page): Locator {
  return page.getByRole('toolbar', { name: 'Maze controls' });
}

export function metrics(page: Page): Locator {
  return page.getByLabel('Maze metrics');
}

/** The visually hidden polite live region used for status announcements (not the PWA toast). */
export function liveStatus(page: Page): Locator {
  return page.locator('.sr-only[aria-live="polite"]');
}

/** Opens /play and waits for generation to finish (speed is seeded to the maximum). */
export async function openPlayReady(page: Page): Promise<void> {
  await page.goto('/play');
  // First paint can be slow when several software-rendered WebGL pages start at once.
  await expect(toolbar(page)).toBeVisible({ timeout: 30_000 });
  await expect(canvasHost(page)).toHaveAttribute(
    'aria-label',
    /cells, (generation in progress|complete)/,
    { timeout: 30_000 },
  );
  await runToEndIfNeeded(page);
  await expect(canvasHost(page)).toHaveAttribute('aria-label', /complete/, { timeout: 30_000 });
}

/**
 * Clicks "Run to end" unless generation has already finished. The button becomes disabled
 * the moment the generator completes, so a check-then-click would race; a bounded click that
 * tolerates "disabled" is the robust form.
 */
export async function runToEndIfNeeded(page: Page): Promise<void> {
  const runToEnd = toolbar(page).getByRole('button', { name: 'Run to end' });
  try {
    await runToEnd.click({ timeout: 3_000 });
  } catch {
    // Already complete (button disabled): nothing to do.
  }
}

/** True when headless Chromium can create a WebGL context (SwiftShader in CI). */
export async function webglAvailable(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const c = document.createElement('canvas');
      return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
    } catch {
      return false;
    }
  });
}
