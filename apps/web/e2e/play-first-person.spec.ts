import { canvasHost, expect, liveStatus, openPlayReady, test, toolbar } from './fixtures';

const HUD = /row \d+, column \d+, facing (north|east|south|west)/;

test.describe('play: first-person "Run maze"', () => {
  test('moves and turns with the keyboard and exits with Escape', async ({ page }) => {
    await openPlayReady(page);

    const runMaze = toolbar(page).getByRole('button', { name: 'Run maze' });
    await expect(runMaze).toBeEnabled();
    await runMaze.click();

    await expect(toolbar(page).getByRole('button', { name: 'Exit maze' })).toBeVisible();
    await expect(liveStatus(page)).toContainText(/Run Maze: arrow keys/);
    await expect(canvasHost(page)).toHaveAttribute('aria-label', /first-person mode/);

    const hud = page.getByText(HUD);
    await expect(hud).toBeVisible();
    const start = (await hud.textContent()) ?? '';
    expect(start).toMatch(/row 1, column 1/);

    // The initial heading faces the first open passage, so one step forward always moves.
    await page.keyboard.press('ArrowUp');
    await expect(hud).not.toHaveText(start);
    const moved = (await hud.textContent()) ?? '';
    expect(moved).toMatch(HUD);

    // Turning changes the heading but not the position.
    const position = /row \d+, column \d+/.exec(moved)?.[0] ?? '';
    await page.keyboard.press('ArrowRight');
    await expect(hud).toContainText(position);
    await expect(hud).not.toHaveText(moved);

    // Peek is a held key.
    await page.keyboard.down('p');
    await expect(hud).toContainText('(peeking)');
    await page.keyboard.up('p');
    await expect(hud).not.toContainText('(peeking)');

    await page.keyboard.press('Escape');
    await expect(toolbar(page).getByRole('button', { name: 'Run maze' })).toBeVisible();
    await expect(hud).toHaveCount(0);
    await expect(liveStatus(page)).toContainText('Left Run Maze mode');
  });
});
