import test from 'node:test';
import assert from 'node:assert/strict';
import { getDistance } from 'ol/sphere.js';
import { createFootprint, tileCoverage } from '../src/domain/geometry.js';

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
    assert.equal(footprint.outputSize, 512);
    assert.ok(tileCoverage(footprint).tiles.length <= 25);
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
