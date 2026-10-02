import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, openPlayReady, test, toolbar } from './fixtures';

type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

/** Fails on serious/critical violations; prints moderate/minor ones for the follow-up list. */
async function expectNoSeriousViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const blocking = results.violations.filter(
    (v: Violation) => v.impact === 'serious' || v.impact === 'critical',
  );
  const advisory = results.violations.filter(
    (v: Violation) => v.impact !== 'serious' && v.impact !== 'critical',
  );
  if (advisory.length > 0) {
    console.info(
      `[axe] ${label}: ${advisory.length} advisory issue(s):\n` +
        advisory
          .map((v: Violation) => `  - ${v.id} (${v.impact ?? 'n/a'}): ${v.help} [${v.nodes.length} node(s)]`)
          .join('\n'),
    );
  }
  expect(
    blocking.map((v: Violation) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(' ')),
    })),
    `${label}: serious/critical axe violations`,
  ).toEqual([]);
}

test.describe('accessibility (axe)', () => {
  test('landing page has no serious or critical violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Maze Lab' })).toBeVisible();
    await expectNoSeriousViolations(page, '/');
  });

  test('play page has no serious or critical violations', async ({ page }) => {
    await openPlayReady(page);
    await expectNoSeriousViolations(page, '/play');
  });

  test('play page with the options sheet open has no serious or critical violations', async ({ page }) => {
    await openPlayReady(page);
    await toolbar(page).getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('dialog', { name: 'Maze options' })).toBeVisible();
    await expectNoSeriousViolations(page, '/play + options');
  });

  test('stub pages have no serious or critical violations', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible();
    await expectNoSeriousViolations(page, '/learn');
  });
});
