import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateListing, retainedPhotos, listingVersion } from '../src/lib/listing-validation.js';

const listing = {
  cropName: 'আলু',
  quantity: '৫০০.১২৫',
  unit: 'kg',
  pricePerUnit: '২৫.৫০',
  harvestDate: '2026-11-20',
  availableDate: '2026-11-22',
  district: 'বগুড়া',
  upazila: 'শিবগঞ্জ',
  farmAddress: 'মহাস্থান, শিবগঞ্জ, বগুড়া',
  description: 'খামার থেকে সদ্য সংগ্রহ করা আলু।',
};

test('listing quantities and prices preserve decimal precision and normalize Bangla digits', () => {
  const value = validateListing(listing);
  assert.equal(value.quantity, '500.125');
  assert.equal(value.pricePerUnit, '25.50');
  assert.equal(
    validateListing({ ...listing, quantity: '999999999.999', pricePerUnit: '9999999999.99' })
      .quantity,
    '999999999.999',
  );
  assert.equal(validateListing({ ...listing, quantity: '0' }, { soldOut: true }).quantity, '0');
  // Past harvest dates are useful for already harvested crops.
  assert.equal(
    validateListing({ ...listing, harvestDate: '2020-02-29' }).harvestDate,
    '2020-02-29',
  );
});

test('listing validation rejects invalid dates, quantities, units and missing required data', () => {
  for (const [key, value] of [
    ['cropName', ''],
    ['district', ''],
    ['upazila', ''],
    ['farmAddress', ''],
    ['description', ''],
    ['quantity', '0'],
    ['quantity', '-1'],
    ['quantity', '1e3'],
    ['quantity', '1.0001'],
    ['quantity', '1000000000'],
    ['quantity', true],
    ['quantity', []],
    ['pricePerUnit', '0'],
    ['pricePerUnit', '2.999'],
    ['pricePerUnit', '10000000000'],
    ['unit', 'unknown'],
    ['harvestDate', '2026-02-30'],
    ['harvestDate', '2026-13-01'],
    ['availableDate', '2026-11-19'],
    ['availableDate', 'not-a-date'],
  ]) {
    assert.throws(
      () => validateListing({ ...listing, [key]: value }),
      (error) => error.status === 422 && Boolean(error.fields[key]),
      `${key}=${value}`,
    );
  }
  assert.throws(
    () => validateListing({ ...listing, unit: 'piece', quantity: '1.5' }),
    (error) => error.status === 422 && Boolean(error.fields.quantity),
  );
});

test('listing versions and retained photo names cannot contain paths, duplicates or malformed values', () => {
  const name = 'c382327b-5682-4ab4-baf6-2d70ec977eb5.webp';
  assert.deepEqual(retainedPhotos(JSON.stringify([name])), [name]);
  assert.equal(listingVersion('১২'), 12);
  for (const photos of [null, '{}', ['../photo.webp'], [name, name], Array(6).fill(name)])
    assert.throws(
      () => retainedPhotos(photos),
      (error) => error.status === 422,
    );
  for (const version of [0, -1, '1.5', '1e2', undefined, '4294967295'])
    assert.throws(
      () => listingVersion(version),
      (error) => error.status === 422,
    );
});
