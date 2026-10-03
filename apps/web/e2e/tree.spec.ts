import AxeBuilder from '@axe-core/playwright';
import { canvasHost, expect, openPlayReady, test, toolbar, webglAvailable } from './fixtures';

test.describe('tree view', () => {
  test('pull the maze out into its tree, explore the outline, switch layouts and back', async ({
    page,
  }) => {
    await openPlayReady(page);
    await toolbar(page).getByRole('radio', { name: 'Tree view' }).click();
    await expect(canvasHost(page)).toHaveAttribute('aria-label', /shown as a tree/);

    // The tree controls sit below the maze, never on top of it.
    const controls = page.getByRole('toolbar', { name: 'Tree view controls' });
    await expect(controls).toBeVisible();
    const canvasBox = await canvasHost(page).boundingBox();
    const controlsBox = await controls.boundingBox();
    expect(canvasBox && controlsBox && controlsBox.y >= canvasBox.y + canvasBox.height - 1).toBe(
      true,
    );

    // The outline: the start corridor, then the solution path first among its branches.
    const outline = page.getByRole('tree', { name: 'Maze as a tree' });
    const root = outline.getByRole('treeitem').first();
    await expect(root).toHaveText(/^Start: /);
    await root.focus();
    await page.keyboard.press('ArrowRight');
    await expect(outline.getByRole('treeitem').nth(1)).toBeFocused();
    await expect(outline.getByRole('treeitem').nth(1)).toHaveText(/^Solution path/);

    await controls.getByRole('radio', { name: 'Radial layout' }).click();
    await expect(controls.getByRole('radio', { name: 'Radial layout' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    if (await webglAvailable(page)) {
      await controls.getByRole('radio', { name: '3D tree layout' }).click();
      // The 3D tree uses the three.js renderer: the orbit buttons appear.
      await expect(
        page.getByRole('group', { name: 'View controls' }).getByRole('button', {
          name: 'Rotate clockwise',
        }),
      ).toBeVisible();
    }

    // Y leaves the tree view; the maze comes back.
    await canvasHost(page).focus();
    await page.keyboard.press('y');
    await expect(controls).toBeHidden();
    await expect(canvasHost(page)).not.toHaveAttribute('aria-label', /shown as a tree/);
  });

  test('the tree view has no serious or critical accessibility violations', async ({ page }) => {
    await openPlayReady(page);
    await toolbar(page).getByRole('radio', { name: 'Tree view' }).click();
    await expect(page.getByRole('tree', { name: 'Maze as a tree' })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target.join(' ')) }));
    expect(blocking).toEqual([]);
  });
});
