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
  await page.route('**/api/poi?**', (route) =>
    route.fulfill({ json: { description: '上海市黄浦区南京东路；外滩街道；和平饭店' } }),
  );
  await page.route('**/api/agnes', (route) =>
    route.fulfill({
      json: {
        code: 0,
        request_id: 'agnes_fixture',
        data: {
          result_format: 'json',
          result: {
            change: {
              changed: true,
              before_type: '绿地',
              after_type: '建设用地',
              description: '测试变化结论',
              confidence: 0.91,
            },
            findings: [],
          },
          meta: { model_version: 'agnes-2.5-flash' },
        },
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

test('region card loads POI then retrieves the closest historical image for a time point', async ({
  page,
}) => {
  await imageryFixture(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'TerraChron' })).toBeVisible();
  await page.getByRole('button', { name: '截取并加入区域库' }).click();
  await expect(page.getByTestId('poi-description')).toContainText('和平饭店');
  const library = page.getByTestId('region-panel');
  const libraryBox = await library.boundingBox();
  expect(libraryBox.x).toBeGreaterThan(900);
  expect(libraryBox.width).toBeLessThanOrEqual(370);
  await page.getByTestId('poi-description').hover();
  await expect(page.getByTestId('poi-tooltip')).toContainText(
    '上海市黄浦区南京东路；外滩街道；和平饭店',
  );
  await expect(page.getByTestId('poi-tooltip')).toHaveClass(/poi-floating-tooltip/);
  const tooltipBox = await page.getByTestId('poi-tooltip').boundingBox();
  expect(tooltipBox.y).toBeGreaterThan(libraryBox.y);
  await expect(page.getByText('目标时间点')).toBeVisible();
  const yearBox = await page.getByLabel('目标年份').boundingBox();
  const monthBox = await page.getByLabel('目标月份').boundingBox();
  const dayBox = await page.getByLabel('目标日期').boundingBox();
  expect(yearBox.y).toBeCloseTo(monthBox.y, 0);
  expect(monthBox.y).toBeCloseTo(dayBox.y, 0);
  await expect(page.getByTestId('history-preview')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /获取历史图像/ })).toBeDisabled();
  await page.getByLabel('目标年份').selectOption('2020');
  await page.getByRole('button', { name: /获取历史图像/ }).click();
  await expect(page.getByTestId('history-preview')).toBeVisible();
  await expect(page.getByTestId('history-preview')).toContainText('2020-06-01');
  const modelPanel = page.getByTestId('model-panel');
  await expect(modelPanel).toBeVisible();
  await expect(modelPanel).toContainText('历史影像 · 2020-06-01');
  await expect(modelPanel).toContainText('和平饭店');
  const modelBeforeDrag = await modelPanel.boundingBox();
  await modelPanel.locator('.panel-heading').hover();
  await page.mouse.down();
  await page.mouse.move(modelBeforeDrag.x - 90, modelBeforeDrag.y + 80);
  await page.mouse.up();
  const modelAfterDrag = await modelPanel.boundingBox();
  expect(modelAfterDrag.width).toBeLessThanOrEqual(380);
  await expect(modelPanel.getByRole('button', { name: '发送模型请求' })).toBeEnabled();
  await modelPanel.getByRole('button', { name: '发送模型请求' }).click();
  await expect(modelPanel).toContainText('检测到变化');
  await expect(modelPanel).toContainText('绿地');
  await expect(modelPanel).toContainText('建设用地');
  await expect(page.getByTestId('main-map')).toHaveAttribute('data-basemap', 'esri-current');
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
