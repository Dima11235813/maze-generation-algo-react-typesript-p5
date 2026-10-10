import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

/** The maze is 15 x 10 by default and the 2D renderer fits it with a 12 px margin. */
const COLS = 15;
const ROWS = 10;
const MARGIN = 12;

test.describe('build', () => {
  test('a real tap near a wall toggles it; the keyboard cursor edits; undo restores', async ({
    page,
  }) => {
    await page.goto('/build');
    await expect(page.getByRole('toolbar', { name: 'Build controls' })).toBeVisible({
      timeout: 30_000,
    });
    const canvas = page.getByTestId('maze-canvas-host');
    await expect(page.getByText(/A perfect maze/)).toBeVisible();

    // Tap just left of the line between the first two cells of the top row.
    const box = (await canvas.boundingBox())!;
    const cs = Math.min((box.width - 2 * MARGIN) / COLS, (box.height - 2 * MARGIN) / ROWS);
    const ox = box.x + (box.width - COLS * cs) / 2;
    const oy = box.y + (box.height - ROWS * cs) / 2;
    await page.mouse.click(ox + cs - 2, oy + cs / 2);
    await expect(page.getByText(/A perfect maze/)).toBeHidden();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText(/A perfect maze/)).toBeVisible();

    // Keyboard: move the cursor, then place the goal on it.
    const status = page.getByTestId('build-status');
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await expect(status).toContainText('row 1, column 2');
    await page.keyboard.press('g');
    await expect(status).toContainText('(goal)');
    await page.keyboard.press('u');
    await expect(status).not.toContainText('(goal)');
  });

  test('the build page has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/build');
    await expect(page.getByRole('toolbar', { name: 'Build controls' })).toBeVisible({
      timeout: 30_000,
    });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target.join(' ')) }));
    expect(blocking).toEqual([]);
  });
});
