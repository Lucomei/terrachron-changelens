import test from 'node:test';
import assert from 'node:assert/strict';
import { createEsriProvider } from '../src/services/providers/esri.js';
import { createFootprint } from '../src/domain/geometry.js';

test('discovers union of changed versions for every region tile', async () => {
  const asked = new Set();
  const provider = createEsriProvider(async (url) => {
    if (url.includes('waybackconfig'))
      return {
        10: {
          itemTitle: 'World Imagery (Wayback 2020-01-01)',
          itemURL: 'https://tiles/10/{level}/{row}/{col}',
          metadataLayerUrl: 'https://meta/10',
        },
        20: {
          itemTitle: 'World Imagery (Wayback 2021-01-01)',
          itemURL: 'https://tiles/20/{level}/{row}/{col}',
          metadataLayerUrl: 'https://meta/20',
        },
      };
    const [release, z, y, x] = new URL(url).pathname.split('/').slice(-4).map(Number);
    asked.add(`${x}/${y}`);
    return { data: [1], select: [release === 20 && x % 2 === 0 ? 20 : 10] };
  });
  const result = await provider.discover(createFootprint([121.4737, 31.2304]));
  assert.deepEqual(result.map((r) => r.releaseId).sort(), ['10', '20']);
  assert.ok(asked.size > 1);
});

test('metadata requests footprint geometry and retains distinct dates and polygons', async () => {
  const provider = createEsriProvider(async (url) => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('geometryType'), 'esriGeometryPolygon');
    assert.equal(parsed.searchParams.get('returnGeometry'), 'true');
    return {
      features: [
        { attributes: { SRC_DATE2: 1577836800000, NICE_DESC: 'A' }, geometry: { rings: [] } },
        { attributes: { SRC_DATE2: 1609459200000, NICE_DESC: 'B' }, geometry: { rings: [] } },
        { attributes: { SRC_DATE2: null }, geometry: { rings: [] } },
      ],
    };
  });
  const result = await provider.metadata(createFootprint([121.47, 31.23]), {
    metadataLayerUrl: 'https://meta/server',
  });
  assert.deepEqual(result.capturedDates, ['2020-01-01', '2021-01-01']);
  assert.equal(result.sources.length, 3);
  assert.equal(result.hasUnknownDates, true);
});
