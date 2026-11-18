import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const previewPort = process.env.SC_PREVIEW_PORT ?? '43155';
let browser;

before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function openSetup(t) {
  const page = await browser.newPage({ viewport: { width: 560, height: 480 } });
  t.after(() => page.close());
  await page.goto(`http://127.0.0.1:${previewPort}/?surface=setup`);
  await page.addStyleTag({ content: '.preview-toolbar { display: none; }' });
  const service = page.getByRole('combobox', { name: 'API service' });
  const menu = page.getByRole('listbox', { name: 'API service' });
  const form = page.locator('.setup-content');
  await service.waitFor();
  const scroll = await form.evaluate(async (element) => {
    await element.ownerDocument.fonts.ready;
    const maxScrollTop = element.scrollHeight - element.clientHeight;
    element.scrollTop = Math.floor(maxScrollTop / 2);
    return { scrollTop: element.scrollTop, maxScrollTop };
  });
  assert.ok(scroll.scrollTop > 0 && scroll.scrollTop < scroll.maxScrollTop, 'form can scroll in both directions');
  return { page, service, menu, form };
}

async function wheel(page, deltaY) {
  await page.mouse.wheel(0, deltaY);
  // Wheel dispatch can return before Chromium scrolls. Separate the gestures.
  await delay(250);
}

function menuPosition(menu) {
  return menu.evaluate((element) => ({
    listScrollTop: element.scrollTop,
    formScrollTop: element.closest('.setup-content').scrollTop,
    y: element.getBoundingClientRect().y
  }));
}

for (const [boundary, delta] of [['bottom', 300], ['top', -300]]) {
  test(`the open setup service menu contains wheel input at its ${boundary} boundary`, async (t) => {
    const { page, service, menu } = await openSetup(t);
    await service.click();
    await menu.hover();
    const maxScrollTop = await menu.evaluate((element) => element.scrollHeight - element.clientHeight);
    assert.ok(maxScrollTop > 0, 'menu has scrollable options');
    const start = await menuPosition(menu);
    assert.equal(start.listScrollTop, 0);

    await wheel(page, 300);
    assert.deepEqual(await menuPosition(menu), { ...start, listScrollTop: maxScrollTop });
    if (delta < 0) {
      await wheel(page, delta);
      assert.deepEqual(await menuPosition(menu), start);
    }

    const beforeBoundary = await menuPosition(menu);
    await wheel(page, delta);
    assert.deepEqual(await menuPosition(menu), beforeBoundary, 'another wheel gesture keeps the form and popup steady');
  });
}

test('the setup service menu retains keyboard navigation and closing restores form scrolling', async (t) => {
  const { page, service, menu, form } = await openSetup(t);
  await service.press('ArrowDown');
  for (const [key, option] of [['End', 'DeepSeek'], ['ArrowUp', 'OpenRouter'], ['Home', 'OpenAI'], ['ArrowDown', 'Groq']]) {
    await service.press(key);
    assert.equal(await service.getAttribute('aria-activedescendant'), await menu.getByRole('option', { name: option, exact: true }).getAttribute('id'));
  }
  await service.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  assert.equal(await service.getAttribute('aria-expanded'), 'false');
  assert.ok(await service.evaluate((element) => element === element.ownerDocument.activeElement));

  await form.hover();
  const beforeWheel = await form.evaluate((element) => element.scrollTop);
  await wheel(page, 300);
  assert.ok(await form.evaluate((element) => element.scrollTop) > beforeWheel, 'wheel scrolls the form with the menu closed');
});
