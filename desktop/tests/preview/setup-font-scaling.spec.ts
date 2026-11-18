import { chromium, expect, test } from '@playwright/test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

for (const { rootSize, expectedSizes } of [
  { rootSize: 16, expectedSizes: ['15px', '20px', '12px', '12px', '13px'] },
  { rootSize: 24, expectedSizes: ['22.5px', '30px', '18px', '18px', '19.5px'] }
]) {
  test(`setup text and actions fit with a ${rootSize}px default font`, async ({ baseURL }, testInfo) => {
    const profile = testInfo.outputPath('chrome-profile');
    await mkdir(join(profile, 'Default'), { recursive: true });
    await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({
      webkit: { webprefs: { default_font_size: rootSize } }
    }));

    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chrome',
      baseURL,
      viewport: { width: 320, height: 360 }
    });
    try {
      const page = await context.newPage();
      await page.goto('/?surface=setup');
      await expect(page.locator('html')).toHaveCSS('font-size', `${rootSize}px`);

      const setup = page.getByRole('region', { name: 'Set up SC' });
      const instructions = setup.getByText('Choose your service and enter its API key to get started.');
      const privacy = setup.locator('#setup-privacy');
      const text = [
        setup.getByRole('heading', { level: 1 }),
        setup.getByRole('heading', { level: 2 }),
        instructions,
        privacy,
        setup.locator('label[for="setup-key"]')
      ];
      expect(await Promise.all(text.map((item) =>
        item.evaluate((element) => getComputedStyle(element).fontSize)
      ))).toEqual(expectedSizes);

      for (const paragraph of [instructions, privacy]) {
        await paragraph.scrollIntoViewIfNeeded();
        await expect(paragraph).toBeInViewport();
        const { lineCount, fitsWidth } = await paragraph.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const lines = Array.from(range.getClientRects());
          const bounds = element.getBoundingClientRect();
          return {
            lineCount: lines.length,
            fitsWidth: lines.every((line) => line.left >= bounds.left && line.right <= bounds.right)
          };
        });
        if (rootSize === 24) expect(lineCount).toBeGreaterThan(1);
        expect(fitsWidth).toBe(true);
      }

      if (rootSize === 24) {
        const content = setup.locator('.setup-content');
        const finalPrivacyLineVisible = () => privacy.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const line = Array.from(range.getClientRects()).at(-1)!;
          const scrollport = element.closest('.setup-content')!.getBoundingClientRect();
          const footer = element.closest('form')!.querySelector('footer')!.getBoundingClientRect();
          return line.top >= scrollport.top && line.bottom <= Math.min(scrollport.bottom, footer.top);
        });
        await content.hover();
        await page.mouse.wheel(0, -1000);
        await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(0);
        expect(await finalPrivacyLineVisible()).toBe(false);
        await page.mouse.wheel(0, 1000);
        await expect.poll(finalPrivacyLineVisible).toBe(true);
      }

      const save = setup.getByRole('button', { name: 'Save', exact: true });
      const cancel = setup.getByRole('button', { name: 'Cancel', exact: true });
      await setup.getByRole('checkbox', { name: 'Show API key' }).press('Tab');
      await expect(save).toBeFocused();
      await expect(save).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Tab');
      await expect(cancel).toBeFocused();
      await expect(cancel).toBeInViewport({ ratio: 1 });
      await save.click();
      await expect(setup.getByRole('alert')).toHaveText('Enter your OpenAI API key without line breaks or control characters.');
      await cancel.click();
      await expect(setup).toHaveCount(0);
    } finally {
      try { await context.close(); } finally { await rm(profile, { recursive: true, force: true }); }
    }
  });
}
