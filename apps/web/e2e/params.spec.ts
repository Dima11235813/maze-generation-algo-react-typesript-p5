import { expect, test } from './fixtures';

test.describe('algorithm parameters', () => {
  test('weighted A* on Watch: the parameter form re-arms the solve and stats show the cost', async ({
    page,
  }) => {
    await page.goto('/watch?seed=e2e-params');
    const transport = page.getByRole('toolbar', { name: 'Watch controls' });
    await expect(transport).toBeVisible({ timeout: 30_000 });

    const picker = page.getByRole('group', { name: 'Solver' });
    if (!(await picker.isVisible())) await page.getByRole('button', { name: /^Solver/ }).click();
    await picker.getByRole('radio', { name: /^A\* Search/ }).check();

    const form = page.getByRole('region', { name: 'A* Search parameters' });
    const weight = form.getByRole('slider', { name: 'Heuristic weight' });
    await weight.focus();
    await page.keyboard.press('End');
    await expect(weight).toHaveAttribute('aria-valuenow', '5');
    await expect(form.getByRole('button', { name: 'Reset A* Search parameters' })).toBeEnabled();

    await transport.getByRole('button', { name: 'Run to end' }).click();
    await expect(page.getByRole('status')).toContainText(/Solved with A\* Search/, {
      timeout: 30_000,
    });
    const stats = page.getByLabel('Solver statistics');
    await expect(stats.getByText(/^\d+%$/)).toBeVisible();
    await expect(stats.getByText(/^\d\.\d\dx$/)).toBeVisible();

    // The weight is remembered across reloads.
    await page.reload();
    await expect(
      page
        .getByRole('region', { name: 'A* Search parameters' })
        .getByRole('slider', { name: 'Heuristic weight' }),
    ).toHaveAttribute('aria-valuenow', '5', { timeout: 30_000 });
  });
});
