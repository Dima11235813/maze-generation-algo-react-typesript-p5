import { canvasHost, expect, metrics, runToEndIfNeeded, test, toolbar } from './fixtures';

test.describe('play: generation', () => {
  test('generates a maze and reaches "complete" after Run to end', async ({ page }) => {
    await page.goto('/play');
    await expect(toolbar(page)).toBeVisible();

    // Legacy auto-start: generation begins as soon as the canvas has a size.
    const host = canvasHost(page);
    await expect(host).toHaveAttribute('aria-label', /Maze canvas: \d+ by \d+ cells/);

    await runToEndIfNeeded(page);

    await expect(host).toHaveAttribute('aria-label', /complete/);
    await expect(toolbar(page).getByRole('button', { name: 'Run to end' })).toBeDisabled();

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
    const seedValue = await seed.inputValue();

    // The metrics strip grows after the first completion, which can shrink the canvas host
    // and therefore the grid of the next generation. Regenerate twice from a stable layout
    // and compare the last two runs: same seed + same grid must give the same maze.
    const regenerate = toolbar(page).getByRole('button', { name: 'Regenerate same seed' });
    // Everything except the timing stats (Elapsed, Rate), which legitimately vary per run.
    const structural = (s: string | null) =>
      /Grid.*?Junctions\s*\d+/.exec((s ?? '').replace(/Elapsed.*?(?=Dead ends)/, ''))?.[0];

    await regenerate.click();
    await expect(host).toHaveAttribute('aria-label', /complete/);
    const first = structural(await metrics(page).textContent());

    await regenerate.click();
    await expect(host).toHaveAttribute('aria-label', /complete/);
    const second = structural(await metrics(page).textContent());

    expect(first).toBeTruthy();
    expect(second).toBe(first);
    await expect(seed).toHaveValue(seedValue);
  });
});
