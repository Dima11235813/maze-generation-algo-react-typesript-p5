import { canvasHost, expect, LIBRARY_KEY, liveStatus, openPlayReady, test, toolbar } from './fixtures';

test.describe('play: save and library', () => {
  test('saves the maze and loads it back from the library', async ({ page }) => {
    await openPlayReady(page);

    await toolbar(page).getByRole('button', { name: 'Save' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save maze' });
    await expect(dialog).toBeVisible();
    const name = dialog.getByRole('textbox', { name: 'Name' });
    const defaultName = await name.inputValue();
    expect(defaultName).toMatch(/^Maze \d+x\d+ /);
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(liveStatus(page)).toContainText(`Saved "${defaultName}" to the library.`);

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), LIBRARY_KEY);
    expect(stored).toContain('"sha256:');

    // Generate a different maze, then load the saved one.
    await toolbar(page).getByRole('button', { name: 'Random seed' }).click();
    await expect(canvasHost(page)).toHaveAttribute('aria-label', /complete/);

    await toolbar(page).getByRole('button', { name: 'Library' }).click();
    const library = page.getByRole('dialog', { name: 'Library' });
    await expect(library).toContainText('Mazes saved in this browser (1)');
    await library.getByRole('button', { name: `Load ${defaultName}` }).click();

    await expect(library).toHaveCount(0);
    await expect(page.getByText(`Loaded: ${defaultName}`)).toBeVisible();
    await expect(liveStatus(page)).toContainText(`Loaded "${defaultName}"`);
    await expect(canvasHost(page)).toHaveAttribute('aria-label', /complete/);

    // Delete needs confirmation.
    await toolbar(page).getByRole('button', { name: 'Library' }).click();
    await library.getByRole('button', { name: `Delete ${defaultName}` }).click();
    await library.getByRole('button', { name: `Confirm delete ${defaultName}` }).click();
    await expect(library).toContainText('Nothing saved yet');
  });
});
