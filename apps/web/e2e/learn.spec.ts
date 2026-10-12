import { expect, test } from './fixtures';

test.describe('learn', () => {
  test('from the landing page to a lesson: step the demo, mark it done, progress persists', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Open Learn' }).click();
    await expect(page).toHaveURL(/\/learn$/);
    const modules = page.getByRole('list', { name: 'Modules' });
    await expect(modules.getByRole('heading', { level: 2 })).toHaveCount(12, { timeout: 30_000 });

    await page.getByRole('link', { name: /^Start with/ }).click();
    await expect(page).toHaveURL(/\/learn\/m3-frontier-ring$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'The frontier is a ring' }),
    ).toBeVisible({ timeout: 30_000 });

    // The queue starts with the start cell; one step takes it from the front.
    const queue = page.getByRole('list', { name: 'Queue, front first' });
    await expect(queue.getByRole('listitem')).toHaveCount(1);
    const tools = page.getByRole('toolbar', { name: 'Maze tools' });
    await tools.getByRole('button', { name: /step once/i }).click();
    await expect(page.getByText(/Last taken from the front:/)).toContainText('row 1');
    await expect(
      page.getByRole('list', { name: /pseudo-code/i }).locator('[aria-current="step"]'),
    ).toHaveCount(1);

    await page.getByRole('button', { name: 'Mark as done' }).click();
    await expect(page.getByRole('button', { name: /lesson done/i })).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Learn' })
      .click();
    await expect(page.getByText('1 of 1 lessons done.')).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByText('1 of 1 lessons done.')).toBeVisible({ timeout: 30_000 });
  });
});
