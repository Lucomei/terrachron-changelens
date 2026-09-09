import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchPoiDescription, makePoiDescription } from '../src/services/poi.js';

test('builds a compact AMap description from address components', () => {
  const description = makePoiDescription({
    formatted_address: '上海市黄浦区南京东路 300 号',
    addressComponent: { township: '外滩街道' },
    aois: [{ name: '外滩金融中心' }, { name: '黄浦公园' }, { name: '忽略' }],
    roads: [{ name: '中山东一路' }, { name: '南京东路' }, { name: '忽略' }],
    pois: [{ name: '和平饭店' }, { name: '外白渡桥' }, { name: '上海大厦' }, { name: '忽略' }],
  });
  assert.equal(
    description,
    '上海市黄浦区南京东路 300 号；外滩街道；外滩金融中心、黄浦公园；中山东一路、南京东路；和平饭店、外白渡桥、上海大厦',
  );
});

test('calls the same-origin POI endpoint with WGS84 coordinates', async () => {
  let requested;
  const result = await fetchPoiDescription([121.4737, 31.2304], {
    fetchImpl: async (url) => {
      requested = url;
      return new Response(JSON.stringify({ description: '外滩' }), { status: 200 });
    },
  });
  assert.match(requested, /^\/api\/poi\?longitude=121.4737&latitude=31.2304$/);
  assert.equal(result.description, '外滩');
});
