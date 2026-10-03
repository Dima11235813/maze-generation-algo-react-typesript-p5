import { expect, openPlayReady, PREFS_KEY, test, toolbar } from './fixtures';

test.describe('play: options sheet', () => {
  test('changes persist across a reload', async ({ page }) => {
    await openPlayReady(page);

    await toolbar(page).getByRole('button', { name: 'Options' }).click();
    const sheet = page.getByRole('dialog', { name: 'Maze options' });
    await expect(sheet).toBeVisible();

    const invert = sheet.getByRole('switch', { name: 'Invert colours' });
    await expect(invert).toHaveAttribute('aria-checked', 'false');
    await invert.click();
    await expect(invert).toHaveAttribute('aria-checked', 'true');

    const wall = sheet.getByRole('slider', { name: 'Wall width' });
    const before = Number(await wall.getAttribute('aria-valuenow'));
    await wall.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(wall).toHaveAttribute('aria-valuenow', String(before + 2));
    await expect(wall).toHaveAttribute('aria-valuetext', `${before + 2} pixels`);

    // 3D-only controls follow the legacy visibility rules.
    await expect(sheet.getByRole('switch', { name: 'Use 3D' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(sheet.getByRole('switch', { name: 'Show cube projection' })).toBeVisible();
    await expect(sheet.getByRole('switch', { name: 'Show 3D mirror' })).toBeVisible();

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), PREFS_KEY);
    expect(stored).toContain('"invert":true');

    await page.reload();
    await expect(toolbar(page)).toBeVisible();
    await toolbar(page).getByRole('button', { name: 'Options' }).click();
    const reopened = page.getByRole('dialog', { name: 'Maze options' });
    await expect(reopened.getByRole('switch', { name: 'Invert colours' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(reopened.getByRole('slider', { name: 'Wall width' })).toHaveAttribute(
      'aria-valuenow',
      String(before + 2),
    );

    await reopened.getByRole('button', { name: 'Reset all options' }).click();
    await expect(reopened.getByRole('switch', { name: 'Invert colours' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await page.keyboard.press('Escape');
    await expect(reopened).toHaveCount(0);
  });

  test('turning off 3D hides the projection controls', async ({ page }) => {
    await openPlayReady(page);
    await toolbar(page).getByRole('button', { name: 'Options' }).click();
    const sheet = page.getByRole('dialog', { name: 'Maze options' });
    await sheet.getByRole('switch', { name: 'Use 3D' }).click();
    await expect(sheet.getByRole('switch', { name: 'Show cube projection' })).toHaveCount(0);
    // The sheet is modal (the rest of the page is aria-hidden), so close it first.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(toolbar(page).getByRole('radio', { name: '2D view' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
