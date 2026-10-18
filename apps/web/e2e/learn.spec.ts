import { expect, test } from './fixtures';

test.describe('learn', () => {
  test('from the landing page to a lesson: step, run to a breakpoint, pass the quiz, progress persists', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Open Learn' }).click();
    await expect(page).toHaveURL(/\/learn$/);
    const modules = page.getByRole('list', { name: 'Modules' });
    await expect(modules.getByRole('heading', { level: 2 })).toHaveCount(12, { timeout: 30_000 });

    await expect(page.getByRole('link', { name: /^Start with/ })).toHaveAttribute(
      'href',
      '/learn/m2-backtracker',
    );
    await modules.getByRole('link', { name: /The frontier is a ring/ }).click();
    await expect(page).toHaveURL(/\/learn\/m3-frontier-ring$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'The frontier is a ring' }),
    ).toBeVisible({ timeout: 30_000 });

    // The queue starts with the start cell; one step takes it from the front.
    const queue = page.getByRole('list', { name: 'Queue, front first' });
    await expect(queue.getByRole('listitem')).toHaveCount(1);
    const tools = page.getByRole('toolbar', { name: 'Maze tools' });
    await tools.getByRole('button', { name: /step once/i }).click();
    await expect(page.getByText(/Last taken from the front:/)).toContainText('row 1');
    await expect(
      page.getByRole('list', { name: /pseudo-code/i }).locator('[aria-current="step"]'),
    ).toHaveCount(1);

    // Run until the queue holds more than 6 cells: the try-it that asks for it is ticked.
    await page.getByRole('combobox', { name: 'Run until' }).click();
    await page.getByRole('option', { name: 'the queue holds more than N cells' }).click();
    await page.getByRole('spinbutton', { name: 'N' }).fill('6');
    await page.getByRole('slider', { name: 'Demo speed' }).focus();
    await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Run until the queue holds more than 6 cells' }).click();
    await expect(page.getByTestId('breakpoint-message')).toHaveText(
      /^Stopped at step \d+: the queue holds 7 cells\.$/,
    );
    await expect(page.getByText(/^Try it done\. The queue holds 7 cells/)).toBeVisible();

    // Passing the quiz completes the lesson.
    await expect(page.getByRole('button', { name: 'Mark as done' })).toHaveCount(0);
    const quiz = page.getByRole('form', { name: 'Quiz' });
    for (const answer of [
      'The one at the front of the queue: the earliest found',
      'At most two: some distance d and d + 1',
      'It reaches every cell at its smallest distance first, the goal included',
      'O(V + E)',
    ]) {
      await quiz.getByRole('radio', { name: answer }).check();
    }
    await quiz.getByRole('button', { name: 'Check answers' }).press('Enter');
    await expect(quiz.getByRole('status')).toHaveText(
      '4 of 4 correct. Passed: this lesson is complete.',
    );
    await expect(page.getByRole('button', { name: /lesson done/i })).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Learn' })
      .click();
    await expect(page.getByText(/^1 of \d+ lessons done\./)).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByText(/^1 of \d+ lessons done\./)).toBeVisible({ timeout: 30_000 });
    await expect(modules.getByRole('link', { name: /The frontier is a ring.*done/ })).toBeVisible();
  });
});
