import { expect, test } from '@playwright/test';

test('opens the synthetic Answer directly', async ({ page }) => {
  await page.goto('/?surface=answer');
  await expect(page.getByRole('region', { name: 'Answer', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Question' })).toHaveCount(0);
});

test('opens a fresh, focused Question when the preview link is reloaded', async ({ page }) => {
  await page.goto('/?surface=input&platform=linux');
  const question = page.getByRole('textbox', { name: 'Question' });
  await expect(question).toBeFocused();
  await question.fill('Synthetic draft');
  await question.press('Escape');
  await expect(question).toHaveCount(0);
  await page.reload();
  await expect(question).toBeFocused();
  await expect(question).toHaveValue('');
});
