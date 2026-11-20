import { expect, test, type Page } from '@playwright/test';
import type { AppState, DesktopApi } from '../../src/contracts';

async function openSetup(page: Page, platform: AppState['platform'], legacyNotice: boolean, origin: string) {
  await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.addInitScript((legacy) => {
    Object.defineProperty(window, 'sc', {
      configurable: true,
      set(api: DesktopApi) {
        const { getState, setup } = api;
        let rejectFirstSave = true;
        api.getState = async () => ({ ...await getState(), setupLegacyNotice: legacy });
        api.setup = async (request) => {
          if (rejectFirstSave) {
            rejectFirstSave = false;
            throw new Error('Synthetic storage rejection');
          }
          await setup(request);
        };
        Object.defineProperty(window, 'sc', { value: api });
      },
    });
  }, legacyNotice);
  await page.goto(`/?surface=setup&platform=${platform}`);
  await page.addStyleTag({ content: '.preview-toolbar { display: none !important; }' });
}

test('loads decorative SC artwork in setup and Settings headers', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 420 });
  for (const [surface, title] of [['setup', 'Set up SC'], ['settings', 'SC settings']]) {
    await page.goto(`/?surface=${surface}`);
    const header = page.locator('.dialog-header');
    await expect(header.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const mark = header.locator('img[alt=""]');
    await expect(mark).toBeInViewport({ ratio: 1 });
    await expect(mark).toHaveJSProperty('naturalWidth', 512);
  }
});

for (const viewport of [{ width: 560, height: 480 }, { width: 320, height: 420 }]) {
  for (const platform of ['windows', 'linux'] as const) {
    for (const legacyNotice of [false, true]) {
      test.describe(`${viewport.width}×${viewport.height} ${platform}, migration notice ${legacyNotice ? 'on' : 'off'}`, () => {
        test.use({ viewport });
        test.beforeEach(async ({ page, baseURL }) => {
          await openSetup(page, platform, legacyNotice, baseURL!);
        });

        test('reveals key guidance on entry and after an empty Save', async ({ page }) => {
          const key = page.getByLabel('OpenAI API key');
          const formContent = page.locator('.setup-content');
          const keyring = page.getByText(/Unlock your desktop keyring before saving/);
          if (platform === 'linux') {
            await page.getByRole('combobox', { name: 'API service' }).focus();
            // The field can already be in view while the description above it is clipped.
            const keyBounds = (await key.boundingBox())!;
            await formContent.evaluate((element, keyTop) => {
              element.scrollTop += keyTop - element.getBoundingClientRect().top - 1;
            }, keyBounds.y);
            await page.keyboard.press('Tab');
            await expect(key).toBeFocused();
            await expect(keyring).toBeInViewport({ ratio: 1 });
          }

          await formContent.evaluate((element) => { element.scrollTop = element.scrollHeight; });
          await expect(page.getByText(/Setup saves your service and key without contacting/)).toBeInViewport({ ratio: 1 });
          if (legacyNotice) await expect(page.getByRole('note')).toBeInViewport({ ratio: 1 });

          await page.getByRole('button', { name: 'Save', exact: true }).press('Enter');
          await expect(key).toBeFocused();
          await expect(key).toBeInViewport({ ratio: 1 });
          await expect(page.getByRole('alert').filter({ hasText: 'Enter your OpenAI API key' })).toBeInViewport({ ratio: 1 });
          if (platform === 'linux') await expect(keyring).toBeInViewport({ ratio: 1 });
        });

        test('shows a rejected Save above usable actions and retries the same key', async ({ page }) => {
          const key = page.getByLabel('OpenAI API key');
          const save = page.getByRole('button', { name: 'Save', exact: true });
          const cancel = page.getByRole('button', { name: 'Cancel' });
          await key.fill('synthetic-preview-key');
          await save.click();

          const recovery = page.getByRole('alert').filter({ hasText: 'The key could not be saved.' });
          const footer = page.locator('.setup footer');
          await expect(recovery).toBeInViewport({ ratio: 1 });
          await expect(footer).toBeInViewport({ ratio: 1 });
          const message = (await recovery.boundingBox())!;
          expect(message.y + message.height).toBeLessThanOrEqual((await footer.boundingBox())!.y);
          await expect(key).toHaveValue('synthetic-preview-key');
          await cancel.click({ trial: true });
          await save.click();
          await expect(page.getByTestId('answer-text')).toBeVisible();
        });
      });
    }
  }
}
