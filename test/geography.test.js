import { test } from 'node:test';
import assert from 'node:assert/strict';
import { districts, allUpazilas, findPlace, searchPlaces } from '../shared/geography/index.js';
import { validateLocation } from '../src/lib/location.js';

test('all districts and upazilas have distinct bilingual entries within their district', () => {
  assert.equal(districts.length, 64);
  assert.equal(allUpazilas.length, 495);
  for (const district of districts) {
    assert.equal(findPlace(districts, district.bn), district);
    assert.equal(findPlace(districts, district.en), district);
    for (const place of district.upazilas) {
      assert.equal(place.district, district.bn);
      assert.equal(findPlace(district.upazilas, place.en), place);
      assert.equal(findPlace(district.upazilas, place.bn), place);
    }
  }
});

test('district and upazila searches accept either script and scope repeated names to their district', () => {
  const bogura = findPlace(districts, 'Bogra');
  for (const query of ['bogu', 'বগু']) assert(searchPlaces(districts, query).includes(bogura));
  for (const query of ['shiB', 'শিব']) {
    assert.equal(searchPlaces(bogura.upazilas, query).length, 1);
    assert.equal(searchPlaces(bogura.upazilas, query)[0].bn, 'শিবগঞ্জ');
  }
  assert.equal(searchPlaces(allUpazilas, 'Shibganj').length, 2);
  assert.equal(searchPlaces(findPlace(districts, 'Dhaka').upazilas, 'Shibganj').length, 0);
  assert.equal(findPlace(districts, "Cox’s Bazar").bn, 'কক্সবাজার');
});

test('writes store the selected pair in Bengali and allow edits to unchanged legacy addresses', () => {
  const errors = {};
  assert.deepEqual(validateLocation({ district: 'Bogra', upazila: 'Shibganj' }, errors),
    { district: 'বগুড়া', upazila: 'শিবগঞ্জ' });
  assert.deepEqual(errors, {});
  validateLocation({ district: 'Rangpur', upazila: 'Savar' }, errors);
  assert(errors.upazila);
  const legacy = { district: 'পুরোনো জেলা', upazila: 'পুরোনো উপজেলা' };
  assert.deepEqual(validateLocation(legacy, {}, legacy), legacy);
});
