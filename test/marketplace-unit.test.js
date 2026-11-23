import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canViewMarketDetails, marketplaceQuery } from '../src/lib/marketplace-validation.js';
import { marketListing } from '../src/services/marketplace.js';

test('market access requires an approved buyer or admin; injected approval on other roles does not count', () => {
  for (const user of [
    null,
    { role: 'farmer', buyerProfile: { status: 'approved' } },
    { role: 'buyer', buyerProfile: { status: 'pending' } },
    { role: 'buyer', buyerProfile: { status: 'rejected' } },
    { role: 'buyer' },
  ])
    assert.equal(canViewMarketDetails(user), false);
  assert.equal(canViewMarketDetails({ role: 'buyer', buyerProfile: { status: 'approved' } }), true);
  assert.equal(canViewMarketDetails({ role: 'admin' }), true);
});

test('market filters normalize Bangla decimals and enforce units, ranges, real dates and approved price access', () => {
  const query = marketplaceQuery(
    { q: ' ধান ', unit: 'kg', minQuantity: '৫০০.১২৫', maxPrice: '৩৮.৫০', page: '২' },
    true,
  );
  assert.equal(query.q, 'ধান');
  assert.equal(query.minQuantity, '500.125');
  assert.equal(query.maxPrice, '38.50');
  assert.equal(query.page, 2);
  for (const input of [
    { minPrice: '0', unit: 'kg' },
    { maxPrice: '40', unit: 'kg' },
    { sort: 'price_asc', unit: 'kg' },
  ])
    assert.throws(
      () => marketplaceQuery(input),
      (error) => error.status === 403,
    );
  for (const [input, key] of [
    [{ minQuantity: '5' }, 'unit'],
    [{ sort: 'quantity_desc' }, 'unit'],
    [{ unit: 'unknown' }, 'unit'],
    [{ unit: 'piece', minQuantity: '1.5' }, 'minQuantity'],
    [{ unit: 'kg', minQuantity: '0.0001' }, 'minQuantity'],
    [{ unit: 'kg', minPrice: '50', maxPrice: '20' }, 'maxPrice'],
    [{ unit: 'kg', minQuantity: '100', maxQuantity: '20' }, 'maxQuantity'],
    [{ harvestFrom: '2026-02-30' }, 'harvestFrom'],
    [{ availableFrom: '2026-11-25', availableTo: '2026-11-20' }, 'availableTo'],
    [{ sort: 'farmer.phone' }, 'sort'],
    [{ page: '0' }, 'page'],
    [{ page: '1e2' }, 'page'],
    [{ q: 'x'.repeat(101) }, 'q'],
  ])
    assert.throws(
      () => marketplaceQuery(input, true),
      (error) => error.status === 422 && Boolean(error.fields[key]),
    );
  for (const input of [{ phone: '01900000001' }, { includePrice: 'true' }, { q: ['ধান', 'আলু'] }])
    assert.throws(
      () => marketplaceQuery(input, true),
      (error) => error.status === 422,
    );
});

test('market responses explicitly omit price, address, free text and farmer identity for limited viewers', () => {
  const row = {
    id: 'listing-id',
    cropName: 'ধান',
    quantity: '500',
    unit: 'kg',
    harvestDate: '2026-11-20',
    availableDate: '2026-11-22',
    district: 'বগুড়া',
    upazila: 'শিবগঞ্জ',
    createdAt: new Date(),
    photoFilenames: ['photo.webp'],
    pricePerUnit: '40',
    description: 'ব্যক্তিগত বিবরণ',
    farmAddress: 'ব্যক্তিগত ঠিকানা',
    farmerId: 'private-id',
    version: 20,
    farmer: {
      fullName: 'কৃষক',
      phone: '01900000001',
      email: 'private@example.test',
      farmerProfile: { farmName: 'খামার', nid: '1234567890', avatarFilename: 'private.webp' },
    },
  };
  for (const detail of [false, true]) {
    const limited = marketListing(row, false, detail);
    for (const key of [
      'pricePerUnit',
      'farmer',
      'farmAddress',
      'description',
      'farmerId',
      'version',
    ])
      assert.equal(key in limited, false, key);
  }
  const approved = marketListing(row, true, true);
  assert.equal(approved.farmer.phone, row.farmer.phone);
  assert.equal(approved.farmer.farmAddress, row.farmAddress);
  assert.equal(approved.pricePerUnit, '40');
  for (const value of [row.farmer.email, row.farmer.farmerProfile.nid, row.farmerId])
    assert(!JSON.stringify(approved).includes(value));
});
