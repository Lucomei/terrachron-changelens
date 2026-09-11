import test from 'node:test';
import assert from 'node:assert/strict';
import { getDistance } from 'ol/sphere.js';
import { createFootprint, recommendedOutputSize, tileCoverage } from '../src/domain/geometry.js';

test('256 ground meters remain 256 meters at equator and 60 degrees latitude', () => {
  for (const center of [
    [0, 0],
    [116.39, 39.9],
    [10, 60],
  ]) {
    const footprint = createFootprint(center);
    const ring = footprint.geometry.coordinates[0];
    assert.deepEqual(ring[0], ring[4]);
    for (let i = 0; i < 4; i++) {
      // Independent spherical measurement: ellipsoidal difference stays under 1.5 m.
      assert.ok(Math.abs(getDistance(ring[i], ring[i + 1]) - 256) < 1.5);
    }
    assert.equal(footprint.sizeMeters, 256);
    assert.equal(footprint.outputSize, recommendedOutputSize(center, 256));
    // Source-driven 19th-level sampling uses more tiles at high latitudes,
    // while a 256 m footprint remains a bounded, practical request.
    assert.ok(tileCoverage(footprint).tiles.length <= 64);
  }
});

test('rejects invalid coordinates and footprints spanning the date line', () => {
  for (const center of [
    [NaN, 20],
    [181, 0],
    [0, 86],
    [179.9999, 0],
    ['', 10],
  ]) {
    assert.throws(() => createFootprint(center));
  }
});

test('derives the raster size from the source resolution and ground range', () => {
  const footprint = createFootprint([121.4737, 31.2304], { sizeMeters: 400 });
  assert.equal(footprint.sizeMeters, 400);
  assert.equal(footprint.outputSize, recommendedOutputSize([121.4737, 31.2304], 400));
  const ring = footprint.geometry.coordinates[0];
  assert.ok(Math.abs(getDistance(ring[0], ring[1]) - 400) < 1.5);
});

test('requests the highest Esri tile level that is useful for the output raster', () => {
  const detailed = createFootprint([121.4737, 31.2304], { sizeMeters: 256 });
  assert.equal(tileCoverage(detailed).zoom, 19);
  const capped = createFootprint([121.4737, 31.2304], { sizeMeters: 2048 });
  assert.ok(tileCoverage(capped).zoom < 19);
});

test('rejects impractical capture specifications', () => {
  assert.throws(() => createFootprint([121.47, 31.23], { sizeMeters: 16 }), /范围/);
  assert.throws(() => createFootprint([121.47, 31.23], { sizeMeters: 256, outputSize: 4096 }), /像素/);
});
