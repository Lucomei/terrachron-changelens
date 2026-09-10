import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelClient } from '../src/services/model-client.js';

test('sends historical PNG, POIs and WGS84 metadata as the documented multipart request', async () => {
  let request;
  const client = createModelClient({
    baseUrl: 'http://127.0.0.1:8000/api/v1',
    fetchImpl: async (url, init) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          code: 0,
          message: 'success',
          request_id: 'req_1',
          data: { task_type: 'comprehensive', result_format: 'json', result: {}, meta: {} },
        }),
      );
    },
  });
  await client.analyzeChange({
    image: new Blob(['image'], { type: 'image/png' }),
    filename: 'region_01_2019-11-09.png',
    poiData: { pois: [{ id: 'address', name: '外滩', longitude: 121.47, latitude: 31.23 }] },
    imageMeta: { bbox: [121.47, 31.23, 121.48, 31.24], crs: 'EPSG:4326' },
  });
  assert.equal(request.url, 'http://127.0.0.1:8000/api/v1/analyze');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.body.get('image').name, 'region_01_2019-11-09.png');
  assert.deepEqual(JSON.parse(request.init.body.get('poi_data')).pois[0].name, '外滩');
  assert.deepEqual(JSON.parse(request.init.body.get('image_meta')).bbox, [121.47, 31.23, 121.48, 31.24]);
  assert.equal(request.init.body.get('task_type'), 'comprehensive');
  assert.equal(request.init.body.get('result_format'), 'json');
});

test('fails locally when the local model endpoint has not been configured', async () => {
  await assert.rejects(
    createModelClient({ baseUrl: '' }).analyzeChange({}),
    /VITE_MODEL_API_BASE/,
  );
});
