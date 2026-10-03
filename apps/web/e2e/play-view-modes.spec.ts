import { canvasHost, expect, openPlayReady, test, toolbar, webglAvailable } from './fixtures';

test.describe('play: 2D / 3D view modes', () => {
  test('toggling the view swaps the renderer', async ({ page }) => {
    await openPlayReady(page);
    const webgl = await webglAvailable(page);
    const host = canvasHost(page);
    const view = toolbar(page).getByRole('radiogroup', { name: 'View mode' });

    // Default is 3D (legacy `use3d: true`). With WebGL the three.js canvas is labelled;
    // without it the app shows the fallback alert instead of crashing.
    await expect(view.getByRole('radio', { name: '3D view' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    if (webgl) {
      await expect(host.locator('canvas[aria-label="Maze, 3D view"]')).toHaveCount(1);
    } else {
      await expect(host.getByRole('alert')).toContainText(/3D renderer could not be loaded/);
    }

    await view.getByRole('radio', { name: '2D view' }).click();
    await expect(view.getByRole('radio', { name: '2D view' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(host.locator('canvas[aria-label="Maze, top-down view"]')).toHaveCount(1);
    await expect(host.locator('canvas')).toHaveCount(1);
    // The maze itself is untouched by a view change.
    await expect(host).toHaveAttribute('aria-label', /complete/);

    await view.getByRole('radio', { name: '3D view' }).click();
    await expect(host.locator('canvas[aria-label="Maze, top-down view"]')).toHaveCount(0);
    if (webgl) {
      await expect(host.locator('canvas[aria-label="Maze, 3D view"]')).toHaveCount(1);
    }
  });

  test('camera presets cycle with the V key in 3D', async ({ page }) => {
    await openPlayReady(page);
    const camera = toolbar(page).getByRole('combobox', { name: 'Camera' });
    await expect(camera).toContainText('Tilted');
    await canvasHost(page).focus();
    await page.keyboard.press('v');
    await expect(camera).toContainText('Isometric');
  });
});
