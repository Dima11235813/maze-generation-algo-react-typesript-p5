import { canvasHost, expect, openPlayReady, test } from './fixtures';

test.describe('maze tools', () => {
  test('on a phone the tools are a row below the maze and never cover it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await openPlayReady(page);
    const tools = page.getByRole('toolbar', { name: 'Maze tools' });
    await expect(tools).toHaveAttribute('data-variant', 'row');
    const canvas = await canvasHost(page).boundingBox();
    const box = await tools.boundingBox();
    expect(canvas && box).toBeTruthy();
    // No overlap: the row starts at or below the bottom of the maze.
    expect(box!.y).toBeGreaterThanOrEqual(canvas!.y + canvas!.height - 1);
    // No page-level horizontal overflow from the row.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // The row's actions work: solve from it.
    await tools.getByRole('button', { name: /^Solve with/ }).click();
    await expect(tools.getByRole('button', { name: 'Clear solve' })).toBeVisible();
  });

  test('on a desktop the floating tools can be dragged out of the way and docked again', async ({
    page,
  }) => {
    await openPlayReady(page);
    const tools = page.getByRole('toolbar', { name: 'Maze tools' });
    await expect(tools).toHaveAttribute('data-variant', 'floating');
    // Wait until the panel has measured the maze area and placed itself.
    await expect(tools).toHaveAttribute('style', /left: \d/);
    const before = await tools.boundingBox();
    const grip = tools.getByRole('button', { name: 'Move the maze tools' });
    const g = await grip.boundingBox();
    await page.mouse.move(g!.x + g!.width / 2, g!.y + g!.height / 2);
    await page.mouse.down();
    await page.mouse.move(g!.x - 300, g!.y - 250, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await tools.boundingBox())!.x).toBeLessThan(before!.x - 200);
    const after = await tools.boundingBox();
    expect(after!.y).toBeLessThan(before!.y - 150);
    // Still inside the maze area.
    const canvas = await canvasHost(page).boundingBox();
    expect(after!.x).toBeGreaterThanOrEqual(canvas!.x);
    expect(after!.y).toBeGreaterThanOrEqual(canvas!.y);
    // Double-click on the grip docks it back.
    await grip.dblclick();
    await expect
      .poll(async () => Math.round((await tools.boundingBox())!.x))
      .toBe(Math.round(before!.x));
  });
});
