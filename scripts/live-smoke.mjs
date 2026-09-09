import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('.local', { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  ...(process.env.BROWSER_PROXY
    ? { proxy: { server: process.env.BROWSER_PROXY, bypass: '127.0.0.1,localhost' } }
    : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '截取并加入区域库' }).click();
  await page.getByTestId('latest-preview').waitFor({ state: 'visible', timeout: 60000 });
  console.log('LIVE: latest satellite crop rendered');
  await page.getByRole('button', { name: '获取历史图像', exact: true }).click();
  await page.getByTestId('observation-card').first().waitFor({ state: 'visible', timeout: 120000 });
  const dates = await page.locator('.observation-date').allTextContents();
  console.log('LIVE: acquired dates', dates);
  await page.locator('.history-image img').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.screenshot({ path: '.local/live-desktop.png' });
  await page.getByRole('button', { name: '比对', exact: true }).first().click();
  await page
    .getByAltText('历史影像', { exact: true })
    .waitFor({ state: 'visible', timeout: 60000 });
  await page.screenshot({ path: '.local/live-compare.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('LIVE: comparison rendered; no page errors');
} finally {
  await browser.close();
}
