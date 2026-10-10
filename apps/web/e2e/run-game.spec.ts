import { canvasHost, expect, liveStatus, openPlayReady, test } from './fixtures';

test.describe('run maze as a game', () => {
  test('on a phone: walk from above with the D-pad, undo, hint, all below the maze', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await openPlayReady(page);
    const tools = page.getByRole('toolbar', { name: 'Maze tools' });
    await tools.getByRole('button', { name: /Walk the maze from above/ }).click();

    const bar = page.getByTestId('run-bar');
    await expect(bar).toBeVisible();
    const canvas = await canvasHost(page).boundingBox();
    const box = await bar.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(canvas!.y + canvas!.height - 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // One of the four directions is open from the start.
    const moves = bar.getByTestId('run-moves');
    const pad = bar.getByRole('group', { name: 'Movement controls' });
    for (const name of [/Move up/, /Move right/, /Move down/, /Move left/]) {
      await pad.getByRole('button', { name }).click();
      if ((await moves.textContent()) === '1') break;
    }
    await expect(moves).toHaveText('1');

    await bar.getByRole('button', { name: 'Undo your last move' }).click();
    await expect(moves).toHaveText('0');
    await bar.getByRole('button', { name: /^Hint/ }).click();
    await expect(liveStatus(page)).toContainText(/Hint: head (north|east|south|west)/);

    await bar.getByRole('button', { name: 'Leave the maze' }).click();
    await expect(bar).toBeHidden();
  });
});
