import { expectNoSeriousViolations } from './axe';
import { expect, openPlayReady, test, toolbar } from './fixtures';

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

  test('play page with the options sheet open has no serious or critical violations', async ({
    page,
  }) => {
    await openPlayReady(page);
    await toolbar(page).getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('dialog', { name: 'Maze options' })).toBeVisible();
    await expectNoSeriousViolations(page, '/play + options');
  });

  test('race page after a finished race has no serious or critical violations', async ({
    page,
  }) => {
    await page.goto('/race?seed=axe-race&agents=bfs,astar,dfs&size=12');
    const controls = page.getByRole('toolbar', { name: 'Race controls' });
    await controls.getByRole('button', { name: 'Run to end' }).click();
    await expect(page.getByRole('table', { name: 'Final ranking' })).toBeVisible();
    await expectNoSeriousViolations(page, '/race');
  });

  test('stub pages have no serious or critical violations', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible();
    await expectNoSeriousViolations(page, '/learn');
  });
});
