import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cropSelection, resolveCropName, searchCropCatalog } from '../shared/crop-catalog.js';
import { matchingCropWhere, validateCrop } from '../src/lib/crop-identity.js';

test('crop aliases resolve exactly across scripts while discovery accepts partial names', () => {
  for (const alias of [' alu ', 'POTATO', 'আলু']) assert.deepEqual(resolveCropName(alias), cropSelection('potato'));
  assert.deepEqual(resolveCropName('মিষ্টি কুমড়া'), cropSelection('pumpkin'));
  assert.deepEqual(resolveCropName('sweet potato'), cropSelection('sweet-potato'));
  assert.deepEqual(resolveCropName('RED   potato'), cropSelection('potato', 'red'));
  assert.equal(resolveCropName('pota'), undefined);
  assert(searchCropCatalog('pota').some((entry) => entry.cropId === 'potato'));
  assert.equal(resolveCropName('অজানা আলু'), undefined);
});

test('typed identifiers control labels and reject varieties belonging to another crop', () => {
  const fields = {};
  assert.deepEqual(validateCrop({ cropId: 'potato', varietyId: 'red', cropName: 'untrusted' }, fields),
    cropSelection('potato', 'red'));
  validateCrop({ cropId: 'tomato', varietyId: 'red' }, fields);
  assert(fields.cropName);
  for (const input of [{ cropId: 'unknown' }, { cropName: 'unknown' }, { cropId: 'potato', varietyId: 0 }]) {
    const errors = {};
    validateCrop(input, errors);
    assert(errors.cropName);
  }
});

test('orders and replacements use the requested variety, including historical snapshots', () => {
  assert.deepEqual(matchingCropWhere({ cropName: 'potato' }), { cropId: 'potato' });
  assert.deepEqual(matchingCropWhere({ cropName: 'red potato' }), { cropId: 'potato', varietyId: 'red' });
  assert.deepEqual(matchingCropWhere({ cropName: 'unclassified' }), { cropId: null, cropName: 'unclassified' });
});
