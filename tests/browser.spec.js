import { test, expect } from '@playwright/test';

// Explicit network fixtures exercise real provider parsing, crop rendering and public UI.
async function imageryFixture(page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#25483d';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#91a887';
    ctx.fillRect(0, 70, 256, 18);
    ctx.fillRect(80, 0, 18, 256);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.route('**/waybackconfig.json', (route) =>
    route.fulfill({
      json: {
        10: {
          itemTitle: 'World Imagery (Wayback 2023-01-01)',
          itemURL: 'https://wayback.maptiles.arcgis.com/tiles/10/{level}/{row}/{col}',
          metadataLayerUrl: 'https://metadata.maptiles.arcgis.com/history10/MapServer',
        },
        20: {
          itemTitle: 'World Imagery (Wayback 2025-01-01)',
          itemURL: 'https://wayback.maptiles.arcgis.com/tiles/20/{level}/{row}/{col}',
          metadataLayerUrl: 'https://metadata.maptiles.arcgis.com/history20/MapServer',
        },
      },
    }),
  );
  await page.route('**/tilemap/**', (route) =>
    route.fulfill({
      json: { data: [1], select: [route.request().url().includes('/tilemap/20/') ? 20 : 10] },
    }),
  );
  await page.route('https://metadata.maptiles.arcgis.com/**', (route) =>
    route.fulfill({
      json: {
        features: [
          {
            attributes: {
              SRC_DATE2: route.request().url().includes('history20')
                ? 1590969600000
                : 1546300800000,
              NICE_DESC: 'TEST FIXTURE',
              SAMP_RES: 0.3,
            },
            geometry: { rings: [] },
          },
        ],
      },
    }),
  );
  await page.route(
    /https:\/\/(server\.arcgisonline\.com|wayback\.maptiles\.arcgis\.com)\/(?:.*\/)?(tile|tiles)\//,
    (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(png, 'base64'),
      }),
  );
}

test('latest capture, independent history, compare and real ZIP download', async ({ page }) => {
  await imageryFixture(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'TerraChron' })).toBeVisible();
  await page.getByRole('button', { name: '截取并加入区域库' }).click();
  await expect(page.getByTestId('latest-preview')).toBeVisible();
  await page.getByLabel('开始日期').fill('2020-01-01');
  await page.getByLabel('结束日期').fill('2020-12-31');
  await page.getByRole('button', { name: '获取历史图像', exact: true }).click();
  await page.getByRole('button', { name: '查看历史影像' }).click();
  await expect(page.getByRole('dialog', { name: '历史影像列表' })).toBeVisible();
  await expect(page.getByTestId('history-dialog')).toBeVisible();
  await expect(page.getByTestId('observation-card')).toHaveCount(1);
  await expect(page.getByTestId('observation-card')).toContainText('2020-06-01');
  await expect(page.getByTestId('observation-card')).toContainText('2025-01-01');
  await expect(page.getByTestId('main-map')).toHaveAttribute('data-basemap', 'esri-current');
  await page.getByRole('button', { name: '比对', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '影像时序比对' })).toBeVisible();
  await page.getByRole('button', { name: '卷帘比对' }).click();
  await expect(page.getByLabel('卷帘位置')).toBeVisible();
  const divider = await page.getByRole('button', { name: '拖动卷帘分界线' }).boundingBox();
  await page.mouse.move(divider.x + divider.width / 2, divider.y + divider.height / 2);
  await page.mouse.down();
  await page.mouse.move(divider.x + 70, divider.y + divider.height / 2);
  await page.mouse.up();
  expect(Number(await page.getByLabel('卷帘位置').inputValue())).toBeGreaterThan(55);
  await page.getByRole('button', { name: '关闭比对' }).click();
  await page.getByRole('button', { name: '查看历史影像' }).click();
  await page.getByRole('checkbox', { name: '选择此历史影像用于输出' }).check();
  await page.getByRole('button', { name: '关闭历史影像' }).click();
  await page.getByRole('button', { name: '数据输出' }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载影像数据包' }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/terrachron.*\.zip/);
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: '关闭数据输出' }).click();
  await page.screenshot({ path: 'test-results/desktop.png' });
});

test('coordinate errors and small-screen layout remain usable', async ({ page }) => {
  await imageryFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('经度').fill('181');
  await page.getByRole('button', { name: '截取并加入区域库' }).click();
  await expect(page.getByRole('alert')).toContainText('经度');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/mobile.png' });
});
