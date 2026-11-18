import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const previewPort = process.env.SC_PREVIEW_PORT ?? '43155';
let browser;

before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function openSetup(t, width, height, scrollPadding = '') {
  const page = await browser.newPage({ viewport: { width, height } });
  t.after(() => page.close());
  await page.goto(`http://127.0.0.1:${previewPort}/?surface=setup`);
  await page.addStyleTag({ content: `.preview-toolbar { display: none; } ${scrollPadding}` });
  const service = page.getByRole('combobox', { name: 'API service', exact: true });
  const list = page.getByRole('listbox', { name: 'API service', exact: true });
  await service.waitFor();
  await page.locator('.setup-content').evaluate(async (form) => {
    await form.ownerDocument.fonts.ready;
    form.scrollTop = 0;
  });
  await service.press('ArrowDown');
  await list.waitFor();
  return { page, service, list };
}

async function afterLayout(page) {
  await page.evaluate(() => new Promise((resolve) => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve))));
}

function clippedBy(element) {
  return element.evaluate((node) => {
    const { top, bottom, left, right } = node.getBoundingClientRect();
    const view = node.ownerDocument.defaultView;
    const { outlineStyle, outlineWidth, outlineOffset } = view.getComputedStyle(node);
    const outline = outlineStyle === 'none' ? 0 : Math.max(0, parseFloat(outlineWidth) + parseFloat(outlineOffset));
    const clipped = [];
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const { overflowX, overflowY } = view.getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      const clipTop = bounds.top + parent.clientTop;
      const clipLeft = bounds.left + parent.clientLeft;
      if ((overflowY !== 'visible' && (top - outline < clipTop - 0.5 || bottom + outline > clipTop + parent.clientHeight + 0.5))
        || (overflowX !== 'visible' && (left - outline < clipLeft - 0.5 || right + outline > clipLeft + parent.clientWidth + 0.5))) {
        clipped.push(String(parent.className || parent.tagName));
      }
    }
    return clipped;
  });
}

test('setup scroll padding leaves the service control and entire active row visible at a 280×240 CSS viewport', async (t) => {
  const { page, service, list } = await openSetup(t, 280, 240, '.setup-content { scroll-padding-block: var(--spacing-2); }');
  for (const [key, name] of [['End', 'DeepSeek'], ['Home', 'OpenAI']]) {
    await page.keyboard.press(key);
    await afterLayout(page);
    const option = list.getByRole('option', { name, exact: true });
    assert.equal(await service.getAttribute('aria-activedescendant'), await option.getAttribute('id'));
    assert.deepEqual(await clippedBy(service), [], 'the trigger and its outline fit inside all clipping ancestors');
    assert.deepEqual(await clippedBy(option), [], 'the active row and its outline fit inside all clipping ancestors');
  }
});

for (const [width, height] of [[320, 420], [560, 480]]) {
  test(`a stationary pointer cannot override keyboard selection at ${width}×${height}`, async (t) => {
    const { page, service, list } = await openSetup(t, width, height);
    const first = list.getByRole('option', { name: 'OpenAI', exact: true });
    const last = list.getByRole('option', { name: 'DeepSeek', exact: true });
    const firstBounds = await first.boundingBox();
    await page.mouse.move(firstBounds.x + firstBounds.width / 2, firstBounds.y + firstBounds.height - 6);
    await page.keyboard.press('End');
    await afterLayout(page);
    assert.ok(await list.evaluate((element) => element.scrollTop > 0), 'End moved the list under the pointer');
    assert.equal(await service.getAttribute('aria-activedescendant'), await last.getAttribute('id'));
    await page.keyboard.press('Enter');
    assert.equal(await service.textContent(), 'DeepSeek');
    const key = page.getByLabel('DeepSeek API key', { exact: true });
    assert.ok(await key.evaluate((input) => input === input.ownerDocument.activeElement));

    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('ArrowDown');
    await afterLayout(page);
    assert.equal(await service.getAttribute('aria-activedescendant'), await last.getAttribute('id'));
    await page.keyboard.press('Home');
    const groq = list.getByRole('option', { name: 'Groq', exact: true });
    await groq.hover();
    assert.equal(await service.getAttribute('aria-activedescendant'), await groq.getAttribute('id'));
    await groq.click();
    assert.equal(await service.textContent(), 'Groq');
  });
}
