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

export const SEEDED_PREFS = {
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

/** Polite live region used for status announcements. */
export function liveStatus(page: Page): Locator {
  return page.locator('[aria-live="polite"]');
}

/** Opens /play and waits for generation to finish (speed is seeded to the maximum). */
export async function openPlayReady(page: Page): Promise<void> {
  await page.goto('/play');
  await expect(toolbar(page)).toBeVisible();
  await expect(canvasHost(page)).toHaveAttribute('aria-label', /cells, (generation in progress|complete)/);
  const runToEnd = toolbar(page).getByRole('button', { name: 'Run to end' });
  if (await runToEnd.isEnabled()) await runToEnd.click();
  await expect(canvasHost(page)).toHaveAttribute('aria-label', /complete/);
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
