import { expect, test, toolbar } from './fixtures';

test.describe('landing page', () => {
  test('renders the six pillars and navigates to Play', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Maze Lab' })).toBeVisible();

    const pillars = page.getByRole('list').getByRole('listitem');
    await expect(pillars).toHaveCount(6);
    for (const title of ['Play', 'Watch', 'Race', 'Build', 'Learn', 'Explore']) {
      await expect(page.getByRole('heading', { name: new RegExp(`^${title}`) })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'Open Play' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Preview/ })).toHaveCount(5);

    await page.getByRole('link', { name: 'Start playing' }).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(toolbar(page)).toBeVisible();
  });

  test('primary navigation reaches every pillar route', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Watch', 'Race', 'Build', 'Learn', 'Explore']) {
      await nav.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`/${label.toLowerCase()}$`));
      await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
    }
  });
});
