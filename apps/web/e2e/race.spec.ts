import { expect, liveStatus, test } from './fixtures';

test.describe('race', () => {
  test('pick two solvers, run to the end, the winner is announced', async ({ page }) => {
    await page.goto('/race?seed=e2e-race&agents=bfs,astar&size=15');
    const controls = page.getByRole('toolbar', { name: 'Race controls' });
    await expect(controls).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('race-lane')).toHaveCount(2);

    // Swap A* for depth-first search: the URL and the lanes follow.
    const racers = page.getByRole('group', { name: /Racers/ });
    if (!(await racers.isVisible())) await page.getByRole('button', { name: /Racers/ }).click();
    await racers.getByRole('checkbox', { name: 'Depth-First Search' }).check();
    await expect(page.getByTestId('race-lane')).toHaveCount(3);
    await racers.getByRole('checkbox', { name: 'A* Search' }).uncheck();
    await expect(page.getByTestId('race-lane')).toHaveCount(2);
    await expect(page).toHaveURL(/agents=bfs%2Cdfs|agents=bfs,dfs/);
    await expect(page.getByRole('region', { name: /^Depth-First Search/ })).toBeVisible();

    await controls.getByRole('button', { name: 'Run to end' }).click();
    await expect(liveStatus(page)).toContainText(/Winner: (Breadth|Depth)-First Search/);
    const ranking = page.getByRole('table', { name: 'Final ranking' });
    await expect(ranking).toBeVisible();
    await expect(ranking.getByRole('row')).toHaveCount(3);

    // The same URL reproduces the same race.
    const winner = (await page.getByTestId('race-status').textContent()) ?? '';
    await page.reload();
    await page
      .getByRole('toolbar', { name: 'Race controls' })
      .getByRole('button', { name: 'Run to end' })
      .click();
    await expect(page.getByTestId('race-status')).toHaveText(winner);
  });
});
