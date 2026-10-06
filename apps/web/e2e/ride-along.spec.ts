import { expect, test, webglAvailable } from './fixtures';

test.describe('ride along', () => {
  test('watch the wall follower in first person, step and step back', async ({ page }) => {
    await page.goto('/watch?seed=e2e-ride');
    const transport = page.getByRole('toolbar', { name: 'Watch controls' });
    await expect(transport).toBeVisible({ timeout: 30_000 });
    test.skip(!(await webglAvailable(page)), 'first person needs WebGL');

    const picker = page.getByRole('group', { name: 'Solver' });
    if (!(await picker.isVisible())) await page.getByRole('button', { name: /^Solver/ }).click();
    await picker.getByRole('radio', { name: /^Wall Follower/ }).check();
    await expect(transport.getByRole('button', { name: 'Play' })).toBeEnabled();

    const tools = page.getByRole('toolbar', { name: 'Maze tools' });
    await tools.getByRole('button', { name: /Ride along with the solver/ }).click();
    const bar = page.getByTestId('ride-along-bar');
    await expect(bar).toContainText('at the start');
    await expect(page.getByRole('img', { name: /riding along in first person/ })).toBeVisible();

    const step = transport.getByRole('button', { name: 'Step once' });
    for (let i = 0; i < 6; i++) await step.click();
    await expect(bar).toContainText(/walking \(step 6\)/);
    await transport.getByRole('button', { name: 'Step back' }).click();
    await expect(bar).toContainText(/step 5\)/);

    await bar.getByRole('button', { name: 'Stop riding' }).click();
    await expect(bar).toBeHidden();
  });
});
