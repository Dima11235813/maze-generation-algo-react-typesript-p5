import type { Page } from '@playwright/test';
import { canvasHost, expect, test } from './fixtures';

/** No page-level horizontal scrolling: the document is never wider than the phone. */
async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

/** Opens the header's navigation sheet and taps a page. */
async function navigateTo(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Open navigation' }).tap();
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: label, exact: true })
    .tap();
}

test.describe('phone journey', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('landing, play, watch and race by touch at 390px', async ({ page }) => {
    await page.goto('/');
    await expectNoHorizontalOverflow(page);

    // Landing -> Play (a lazily loaded page).
    await page.getByRole('link', { name: 'Open Play' }).tap();
    await expect(page).toHaveURL(/\/play$/);
    await expect(canvasHost(page)).toHaveAttribute('aria-label', /complete/, { timeout: 30_000 });
    await expectNoHorizontalOverflow(page);

    // Solve from the maze tools row below the maze (nothing sits on the maze on phones).
    await page.getByRole('button', { name: /^Solve with / }).tap();
    await expect(page.getByRole('status').filter({ hasText: /Solved with/ })).toBeAttached({
      timeout: 30_000,
    });

    // Play -> Watch: run the solver to the end with the transport.
    await navigateTo(page, 'Watch');
    await expect(page).toHaveURL(/\/watch/);
    const transport = page.getByRole('toolbar', { name: 'Watch controls' });
    await expect(transport).toBeVisible({ timeout: 30_000 });
    await expectNoHorizontalOverflow(page);
    await transport.getByRole('button', { name: 'Run to end' }).tap();
    await expect(page.getByRole('status').filter({ hasText: /Solved with/ })).toBeAttached({
      timeout: 30_000,
    });

    // Watch -> Race: the race controls are reachable and the page still fits.
    await navigateTo(page, 'Race');
    await expect(page).toHaveURL(/\/race/);
    await expect(page.getByRole('toolbar', { name: 'Race controls' })).toBeVisible({
      timeout: 30_000,
    });
    await expectNoHorizontalOverflow(page);
  });
});
