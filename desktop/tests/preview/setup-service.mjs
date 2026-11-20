import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const previewUrl = `http://127.0.0.1:${process.env.SC_PREVIEW_PORT ?? '43155'}/?surface=setup`;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function measure(service) {
  return service.evaluate((button) => {
    const range = button.ownerDocument.createRange();
    range.selectNodeContents(button);
    const value = range.getBoundingClientRect();
    const control = button.getBoundingClientRect();
    const arrow = button.parentElement.querySelector('.choice-arrow svg').getBoundingClientRect();
    return { value: value.toJSON(), control: control.toJSON(), arrow: arrow.toJSON() };
  });
}

for (const direction of ['ltr', 'rtl']) {
  test(`setup service stays readable and operable at 320px in ${direction}`, async (t) => {
    const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
    t.after(() => page.close());
    await page.goto(previewUrl);
    await page.locator('html').evaluate((root, dir) => { root.dir = dir; }, direction);

    const service = page.getByRole('combobox', { name: 'API service', exact: true });
    await expect(service).toHaveText('OpenAI');
    const initial = await measure(service);
    await page.mouse.click(initial.arrow.x + initial.arrow.width / 2, initial.arrow.y + initial.arrow.height / 2);
    await expect(service).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('option', { name: 'Google Gemini', exact: true }).click();
    await expect(service).toHaveText('Google Gemini');
    await expect(service).toHaveAttribute('aria-expanded', 'false');
    const longest = await measure(service);

    const key = page.getByLabel('Google Gemini API key', { exact: true });
    await expect(key).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(service).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(service).toHaveText('Groq');
    await expect(service).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('Groq API key', { exact: true })).toBeFocused();

    const gaps = Object.entries({ OpenAI: initial, 'Google Gemini': longest }).map(([name, { value, control, arrow }]) => {
      const gap = direction === 'rtl' ? value.left - arrow.right : arrow.left - value.right;
      const overlap = Math.max(0, Math.min(value.right, arrow.right) - Math.max(value.left, arrow.left));
      t.diagnostic(`${name} inline gap: ${gap.toFixed(2)}px, horizontal overlap: ${overlap.toFixed(2)}px`);
      assert.ok(control.left >= 0 && control.right <= 320, 'service control fits inside the viewport');
      assert.ok(value.width > 0 && value.left >= control.left && value.right <= control.right, `${name} fits inside the service control`);
      assert.ok(arrow.left >= control.left && arrow.right <= control.right, 'chevron fits inside the service control');
      return gap;
    });
    assert.ok(gaps.every((gap) => gap > 0), 'chevron has its own space at the inline end');
  });
}
