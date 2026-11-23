import { test } from 'node:test';
import assert from 'node:assert/strict';
import { individualMatchQuery } from '../src/lib/matching-validation.js';

test('individual matching has an explicit date sort and accepts Bangla page numbers', () => {
  assert.deepEqual(individualMatchQuery(), { sort: 'available_asc', page: 1 });
  assert.deepEqual(individualMatchQuery({ sort: 'price_asc', page: '২' }), {
    sort: 'price_asc',
    page: 2,
  });
});
test('matching cannot override the saved crop, quantity, unit or buyer through query parameters', () => {
  for (const query of [
    { cropName: 'ধান' },
    { quantity: '0' },
    { unit: 'ton' },
    { buyerId: 'other' },
    { sort: 'constructor' },
    { sort: 'farmer.phone' },
    { sort: ['price_asc', 'price_desc'] },
    { page: '0' },
    { page: '-1' },
    { page: '1e3' },
    { page: '100001' },
  ])
    assert.throws(
      () => individualMatchQuery(query),
      (error) => error.status === 422,
    );
});
