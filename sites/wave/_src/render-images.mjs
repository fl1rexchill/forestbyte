// Рендер растровых картинок из _src/images.html: OG-превью, логотип для schema.org, PNG-иконки.
// Нужен Chromium и playwright-core:  npm i -D playwright-core  →  node _src/render-images.mjs
// (путь к браузеру можно задать через CHROMIUM_PATH)

import { chromium } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = dirname(fileURLToPath(import.meta.url));
const OUT = join(SRC, '..', 'public');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(SRC, 'images.html')).href);
await page.evaluate(() => document.fonts.ready);

const shot = async (sel, file, size) => {
  if (size) {
    await page.setViewportSize({ width: 512, height: 512 });
    await page.evaluate(([s, px]) => { const el = document.querySelector(s); el.style.zoom = px / 512; }, [sel, size]);
  }
  await page.locator(sel).screenshot({ path: join(OUT, file) });
  if (size) await page.evaluate((s) => { document.querySelector(s).style.zoom = ''; }, sel);
};

await shot('#og', 'assets/img/og.png');
await shot('#logo', 'assets/img/logo.png');
await shot('#icon', 'icon-512.png', 512);
await shot('#icon', 'apple-touch-icon.png', 180);
await shot('#icon', 'favicon-32.png', 32);

await browser.close();
console.log('Картинки готовы: og.png, logo.png, иконки.');
