import { expectNoSeriousViolations } from './axe';
import { expect, test } from './fixtures';

/**
 * Smoke test for every lesson in the curriculum (proj-mgmt/13 section 11: "every demo seed is
 * rendered"): the lessons come from the Learn index, so a new lesson is covered with no change
 * here. Each one renders its demo, takes a step (or selects a cell in a graph demo), and passes
 * axe.
 */
test.describe('every lesson', () => {
  test('renders its demo, steps it and has no serious accessibility violations', async ({
    page,
  }) => {
    test.slow();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/learn');
    const modules = page.getByRole('list', { name: 'Modules' });
    await expect(modules.getByRole('heading', { level: 2 }).first()).toBeVisible({
      timeout: 30_000,
    });
    const hrefs = [
      ...new Set(
        await modules
          .locator('a[href^="/learn/"]')
          .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? '')),
      ),
    ];
    expect(hrefs.length).toBeGreaterThanOrEqual(3);

    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
      const canvas = page.getByRole('img', { name: /^(Demo maze|Graph demo): \d+ by \d+ cells/ });
      await expect(canvas, href).toBeVisible();
      const edit = page.getByRole('group', { name: 'Edit the maze' });
      if ((await edit.count()) > 0) {
        // A graph demo: the first arrow on the maze selects the start cell.
        await canvas.focus();
        await page.keyboard.press('ArrowRight');
        await expect(canvas, href).toHaveAccessibleName(/selected$/);
        await expect(page.getByTestId('tree-verdict'), href).toBeVisible();
      } else {
        const step = page
          .getByRole('toolbar', { name: 'Maze tools' })
          .getByRole('button', { name: /step once/i });
        await expect(step, href).toBeEnabled({ timeout: 30_000 });
        await step.click();
        await expect(
          page.getByRole('list', { name: /pseudo-code/i }).locator('[aria-current="step"]'),
          href,
        ).toHaveCount(1);
      }
      await expect(page.getByRole('form', { name: 'Quiz' }), href).toBeVisible();
      await expectNoSeriousViolations(page, href);
    }
    expect(errors).toEqual([]);
  });
});
