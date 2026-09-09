import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { createPackage, toZip, sendPackage } from '../src/services/transfer.js';
import { createFootprint } from '../src/domain/geometry.js';

const region = {
  id: 'region-1',
  name: '区域 01',
  color: '#abc123',
  ...createFootprint([121, 31]),
  range: { startDate: '2020-01-01', endDate: '2021-01-01' },
  latest: { snapshotAt: '2026-09-09T01:00:00Z' },
};

test('export package has real image bytes plus portable geometry and metadata', async () => {
  const pkg = await createPackage(
    [
      {
        region,
        observations: [{ id: 'obs-1', capturedAt: '2020-06-01', providerId: 'esri-wayback' }],
      },
    ],
    async () => ({ blob: new Blob(['image-bytes'], { type: 'image/png' }), attribution: 'Esri' }),
  );
  assert.equal(pkg.manifest.regions[0].sizeMeters, 256);
  assert.equal(pkg.manifest.images.length, 2);
  assert.equal(pkg.manifest.images[1].capturedAt, '2020-06-01');
  assert.equal(JSON.stringify(pkg.manifest).includes('blob:'), false);
  const files = unzipSync(new Uint8Array(await (await toZip(pkg)).arrayBuffer()));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  assert.equal(strFromU8(files[manifest.images[0].file]), 'image-bytes');
});

test('HTTP handoff transmits manifest and files and rejects failed receivers', async () => {
  const pkg = await createPackage([{ region, observations: [] }], async () => ({
    blob: new Blob(['png'], { type: 'image/png' }),
  }));
  let seen;
  const response = await sendPackage('https://receiver.example/ingest', pkg, {
    request: async (url, options) => {
      seen = options;
      return new Response('{"received":true}', { status: 200 });
    },
  });
  assert.equal(seen.method, 'POST');
  assert.equal(seen.body.get('files').size, 3);
  assert.equal(JSON.parse(seen.body.get('manifest')).version, '1.0');
  assert.equal(response.status, 200);
  await assert.rejects(sendPackage('', pkg), /接收/);
  await assert.rejects(
    sendPackage('https://receiver.example', pkg, {
      request: async () => new Response('', { status: 500 }),
    }),
    /500/,
  );
});
