import { expect, liveStatus, metrics, openPlayReady, test, toolbar } from './fixtures';

test.describe('play: solve', () => {
  test('BFS solves the finished maze and reports the path', async ({ page }) => {
    await openPlayReady(page);

    const solver = toolbar(page).getByRole('combobox', { name: 'Solver' });
    await expect(solver).toContainText('Breadth-First Search');

    const solve = toolbar(page).getByRole('button', { name: 'Solve' });
    await expect(solve).toBeEnabled();
    await solve.click();

    await expect(liveStatus(page)).toContainText(/Solved with Breadth-First Search in \d+ moves/);
    const strip = metrics(page);
    await expect(strip).toContainText(/Solver\s*Breadth-First Search/);
    await expect(strip).toContainText(/Expanded\s*\d+/);
    await expect(strip).toContainText(/Path\s*\d+ moves/);

    // The solved path length equals the maze's shortest solution.
    const text = (await strip.textContent()) ?? '';
    const solution = Number(/Solution\s*(\d+) moves/.exec(text)?.[1]);
    const path = Number(/Path\s*(\d+) moves/.exec(text)?.[1]);
    expect(path).toBe(solution);

    await toolbar(page).getByRole('button', { name: 'Clear solve' }).click();
    await expect(toolbar(page).getByRole('button', { name: 'Solve' })).toBeEnabled();
    await expect(strip).not.toContainText('Expanded');
  });

  test('DFS can be selected and also finds a path', async ({ page }) => {
    await openPlayReady(page);
    const solver = toolbar(page).getByRole('combobox', { name: 'Solver' });
    await solver.click();
    await page.getByRole('option', { name: 'Depth-First Search' }).click();
    await expect(solver).toContainText('Depth-First Search');

    await toolbar(page).getByRole('button', { name: 'Solve' }).click();
    await expect(liveStatus(page)).toContainText(/Solved with Depth-First Search in \d+ moves/);
  });
});
