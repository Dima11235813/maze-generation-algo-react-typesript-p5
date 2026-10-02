import { canvasHost, expect, metrics, test, toolbar } from './fixtures';

test.describe('play: generation', () => {
  test('generates a maze and reaches "complete" after Run to end', async ({ page }) => {
    await page.goto('/play');
    await expect(toolbar(page)).toBeVisible();

    // Legacy auto-start: generation begins as soon as the canvas has a size.
    const host = canvasHost(page);
    await expect(host).toHaveAttribute('aria-label', /Maze canvas: \d+ by \d+ cells/);

    const runToEnd = toolbar(page).getByRole('button', { name: 'Run to end' });
    if (await runToEnd.isEnabled()) await runToEnd.click();

    await expect(host).toHaveAttribute('aria-label', /complete/);
    await expect(runToEnd).toBeDisabled();

    const strip = metrics(page);
    await expect(strip).toContainText('Grid');
    await expect(strip).toContainText(/Cells\s*\d+/);
    await expect(strip).toContainText(/Dead ends\s*\d+/);
    await expect(strip).toContainText(/Solution\s*\d+ moves/);
    await expect(strip).toContainText(/Diameter\s*\d+/);
  });

  test('the same seed regenerates the same maze', async ({ page }) => {
    await page.goto('/play');
    const host = canvasHost(page);
    await expect(host).toHaveAttribute('aria-label', /complete/);
    const seed = page.getByRole('textbox', { name: 'Seed' });
    await expect(seed).not.toHaveValue('');
    const before = await metrics(page).textContent();

    await toolbar(page).getByRole('button', { name: 'Regenerate same seed' }).click();
    await expect(host).toHaveAttribute('aria-label', /complete/);
    const after = await metrics(page).textContent();

    // Structural metrics (dead ends, solution, diameter) are seed-determined.
    const pick = (s: string | null) => (s ?? '').match(/Dead ends.*?Junctions\s*\d+/)?.[0];
    expect(pick(after)).toBe(pick(before));
  });
});
