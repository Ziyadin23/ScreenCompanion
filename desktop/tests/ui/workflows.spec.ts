import { _electron as electron, expect, test as base } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { resolve } from 'node:path';

const test = base.extend<{ desktopApp: ElectronApplication; scPage: Page }>({
  desktopApp: async ({ browserName: _browserName }, use) => {
    const desktopApp = await electron.launch({
      args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), resolve('out/main/index.js'), '--synthetic-ui'],
      env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
    });
    try { await use(desktopApp); } finally { await desktopApp.close(); }
  },
  scPage: async ({ desktopApp }, use) => {
    const page = await desktopApp.firstWindow();
    await expect(page.getByTestId('answer-text')).toHaveText('Synthetic SC answer');
    await use(page);
  }
});

async function settings(page: Page, tab?: string) {
  await page.evaluate(() => window.sc.command({ type: 'settings' }));
  await expect(page.getByTestId('settings-save')).toBeEnabled();
  if (tab) await page.getByRole('tab', { name: tab }).click();
}
async function choice(page: Page, name: string, option: string) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('Updates explains installed-only updates without making requests in the key-free preview', async ({ scPage: page }) => {
  await settings(page, 'Updates');
  await expect(page.getByLabel('SC updates')).toContainText('In-app updates are available in the installed Windows version of SC.');
  await expect(page.getByRole('button', { name: 'Check for updates' })).toHaveCount(0);
  await page.getByTestId('settings-back').click();
  await expect(page.getByTestId('answer-text')).toHaveText('Synthetic SC answer');
});

test('answer-only surface is selectable plain text with independent alpha and invisible resize edges', async ({ scPage: page }) => {
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByTestId('question-input')).toHaveCount(0);
  await expect(page.locator('.resize-edge')).toHaveCount(8);
  const style = await page.getByTestId('answer-text').evaluate((element) => {
    const text = getComputedStyle(element); const panel = getComputedStyle(element.parentElement!);
    return { text: text.color, background: panel.backgroundColor, opacity: panel.opacity, select: text.userSelect, whitespace: text.whiteSpace,
      edge: getComputedStyle(document.querySelector('.edge-left')!).width, scrollbar: text.scrollbarWidth };
  });
  expect(style).toMatchObject({ text: 'rgba(239, 242, 247, 0.8)', opacity: '1', select: 'text', whitespace: 'pre-wrap', edge: '7px', scrollbar: 'none' });
  expect(style.background).toMatch(/rgba\(26, 32, 44, 0\.00/);
});

test('temporary input sends with Enter, reports the key-free preview limit and clears on Escape', async ({ scPage: page }) => {
  await page.evaluate(() => window.sc.command({ type: 'showInput' }));
  await page.getByTestId('question-input').fill('Synthetic typed question');
  await page.getByTestId('question-input').press('Enter');
  await expect(page.getByTestId('answer-text')).toContainText('PREVIEWONLY');
  await expect(page.getByTestId('question-input')).toHaveValue('');
  expect(await page.evaluate(async () => (await window.sc.getState()).answer)).toBe('Synthetic SC answer');
  await page.getByTestId('question-input').press('Escape');
  await expect(page.getByTestId('question-input')).toHaveCount(0);
  await page.evaluate(() => window.sc.command({ type: 'showInput' }));
  await expect(page.getByTestId('question-input')).toHaveValue('');
  await page.getByTestId('question-input').press('Escape');
  await expect(page.getByTestId('question-input')).toHaveCount(0);
});

test('Back discards appearance and Save applies the preview without recoloring Settings', async ({ scPage: page }) => {
  await settings(page, 'Panel');
  const original = await page.locator('.fixed-theme').evaluate((element) => getComputedStyle(element).backgroundColor);
  await choice(page, 'Panel color theme', 'Light');
  await page.getByRole('slider', { name: 'Background transparency', exact: true }).fill('50');
  await page.getByRole('slider', { name: 'Text visibility', exact: true }).fill('25');
  await expect(page.getByTestId('appearance-preview')).toHaveCSS('color', 'rgba(24, 32, 44, 0.25)');
  await expect(page.locator('.fixed-theme')).toHaveCSS('background-color', original);
  await page.getByTestId('settings-back').click();
  await settings(page, 'Panel');
  await expect(page.getByRole('slider', { name: 'Text visibility', exact: true })).toHaveValue('80');
  await choice(page, 'Panel color theme', 'Forest');
  await page.getByTestId('settings-save').click();
  await expect(page.getByTestId('answer-text')).toHaveText('Synthetic SC answer');
  await expect(page.getByTestId('answer-text')).toHaveCSS('color', 'rgba(232, 244, 234, 0.8)');
});

test('service replacement drafts survive switching and are absent after Save', async ({ scPage: page }) => {
  await settings(page, 'Models & API');
  await expect(page.getByTestId('service-key')).toHaveValue('');
  await expect(page.getByText('A key is saved for this service.')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Answer model', exact: true })).toHaveCount(0);
  await page.getByText('Advanced model settings', { exact: true }).click();
  await choice(page, 'API service', 'DeepSeek');
  await page.getByTestId('service-key').fill('synthetic-ui-key');
  await choice(page, 'Request pipeline', 'Direct screenshot (DeepSeek)');
  await choice(page, 'DeepSeek reasoning', 'High');
  await expect(page.getByRole('spinbutton', { name: 'Answer output token limit', exact: true })).toHaveValue('16000');
  await expect(page.getByRole('combobox', { name: 'Screen-reading model', exact: true })).toBeDisabled();
  await choice(page, 'API service', 'Groq');
  await expect(page.getByTestId('service-key')).toHaveValue('');
  await choice(page, 'API service', 'DeepSeek');
  await expect(page.getByTestId('service-key')).toHaveValue('synthetic-ui-key');
  await page.getByTestId('settings-save').click();
  await expect(page.getByTestId('answer-text')).toBeVisible();
  await settings(page, 'Models & API');
  await expect(page.getByTestId('service-key')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'API service', exact: true })).toHaveText('DeepSeek');
});

test('Settings navigation uses one keyboard tab stop and keeps every page inside the dialog', async ({ scPage: page }) => {
  await settings(page);
  await expect(page.getByRole('heading', { name: 'Answer & shortcuts', exact: true })).toBeFocused();
  const first = page.getByRole('tab', { name: 'Answer & shortcuts', exact: true });
  await first.focus(); await first.press('ArrowRight');
  const panel = page.getByRole('tab', { name: 'Panel', exact: true });
  await expect(panel).toBeFocused(); await expect(panel).toHaveAttribute('aria-selected', 'true');
  await panel.press('Tab'); await expect(page.getByRole('tabpanel', { name: 'Panel', exact: true })).toBeFocused();
  await page.getByRole('tabpanel').press('Tab'); await expect(page.getByRole('slider', { name: 'Background transparency', exact: true })).toBeFocused();
  await panel.focus(); await panel.press('End'); await expect(page.getByRole('tab', { name: 'Updates', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: 'Updates', exact: true }).press('Home'); await expect(first).toBeFocused();
  for (const name of ['Answer & shortcuts', 'Panel', 'Models & API', 'Commands', 'Updates']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tabpanel', { name, exact: true })).toBeVisible();
    await expect(page.getByTestId('settings-save')).toBeInViewport(); await expect(page.getByTestId('settings-back')).toBeInViewport();
    const layout = await page.locator('.settings').evaluate((element) => {
      const body = element.querySelector('.settings-body')!;
      const tabs = [...element.querySelectorAll<HTMLElement>('[role=tab]')];
      return { fits: body.scrollWidth <= body.clientWidth, tabStops: tabs.filter((tab) => tab.tabIndex === 0).length,
        referencesValid: [...element.querySelectorAll('[aria-labelledby]')].every((item) => item.getAttribute('aria-labelledby')!.split(/\s+/).every((id) => !!document.getElementById(id))) };
    });
    expect(layout).toEqual({ fits: true, tabStops: 1, referencesValid: true });
  }
  expect(await page.evaluate(async () => (await window.sc.getState()).settingsDirty)).toBe(false);
  await page.getByTestId('settings-back').click();
});

test('advanced model validation opens the right page and focuses the invalid control before Save', async ({ scPage: page }) => {
  await settings(page, 'Models & API');
  const summary = page.getByText('Advanced model settings', { exact: true });
  await summary.focus(); await summary.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Answer model', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Answer model', exact: true }).fill('invalid model id');
  await summary.click(); await page.getByRole('tab', { name: 'Panel', exact: true }).click();
  await page.getByTestId('settings-save').click();
  const model = page.getByRole('combobox', { name: 'Answer model', exact: true });
  await expect(page.getByRole('tab', { name: 'Models & API', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(model).toBeFocused(); await expect(model).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('Enter a valid answer model ID');
  expect(await page.evaluate(async () => (await window.sc.getState()).settingsDirty)).toBe(true);
  await model.fill('gpt-6-luna'); await page.getByTestId('settings-save').click();
  await expect(page.getByTestId('answer-text')).toHaveText('Synthetic SC answer');
  expect(await page.evaluate(async () => (await window.sc.getState()).settingsDirty)).toBe(false);
});

test('hidden Settings retain drafts and Commands/capture test explain recording limits', async ({ scPage: page }) => {
  await settings(page, 'Panel');
  await page.getByRole('slider', { name: 'Text visibility', exact: true }).fill('55');
  await page.evaluate(() => window.sc.command({ type: 'toggleVisibility' }));
  expect(await page.evaluate(async () => (await window.sc.getState()).visible)).toBe(false);
  await page.evaluate(() => window.sc.command({ type: 'toggleVisibility' }));
  await expect(page.getByRole('slider', { name: 'Text visibility', exact: true })).toHaveValue('55');
  await page.getByRole('tab', { name: 'Commands' }).click();
  await expect(page.getByText(/Recording\/stream exclusion is best effort/)).toBeVisible();
  await page.getByTestId('settings-back').click();
  await page.evaluate(() => window.sc.command({ type: 'captureTest' }));
  await expect(page.getByTestId('answer-text')).toContainText('Recording exclusion is best effort');
  await expect(page.getByTestId('answer-text')).toContainText('Inspect the saved video or received stream');
});
