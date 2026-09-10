import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgnesClient } from '../src/services/agnes-client.js';

test('sends a historical image, POI context and the authored prompt to the same-origin Agnes proxy', async () => {
  let request;
  const client = createAgnesClient({
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          code: 0,
          request_id: 'agnes_req_1',
          data: {
            result_format: 'json',
            result: { changed: true, before_type: '绿地', after_type: '建设用地' },
            meta: {},
          },
        }),
      );
    },
  });
  await client.analyzeChange({
    image: new Blob(['historical'], { type: 'image/png' }),
    currentImage: new Blob(['current'], { type: 'image/png' }),
    filename: 'region-01.png',
    currentFilename: 'region-01-current.png',
    poiData: { pois: [{ name: '外滩', address: '上海市黄浦区' }] },
    imageMeta: { bbox: [121.47, 31.23, 121.48, 31.24], acquired_at: '2019-11-09' },
    prompt: '请返回 JSON',
  });
  assert.equal(request.url, '/api/agnes');
  assert.equal(request.init.method, 'POST');
  const payload = JSON.parse(request.init.body);
  assert.equal(payload.image.mimeType, 'image/png');
  assert.equal(payload.image.base64, 'aGlzdG9yaWNhbA==');
  assert.equal(payload.currentImage.base64, 'Y3VycmVudA==');
  assert.equal(payload.currentImage.filename, 'region-01-current.png');
  assert.equal(payload.poiData.pois[0].name, '外滩');
  assert.equal(payload.imageMeta.acquired_at, '2019-11-09');
  assert.equal(payload.prompt, '请返回 JSON');
});
