import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestCollectiveCombinations,
  administrativeProximity,
  scaledDecimal,
} from '../src/lib/collective-matching.js';
import { collectiveMatchQuery, collectiveMatchSorts } from '../src/lib/matching-validation.js';

const row = (id, quantity, changes = {}) => ({
  id: String(id).padStart(3, '0'),
  farmerId: `farmer-${id}`,
  quantity: String(quantity),
  pricePerUnit: '20.00',
  availableDate: '2026-12-01',
  harvestDate: '2026-11-25',
  district: 'বগুড়া',
  upazila: 'শিবগঞ্জ',
  ...changes,
});

test('collective matching classifies exact, inclusive 20% excess and partial without floating-point drift', async () => {
  const rows = [row(1, '0.100'), row(2, '0.200'), row(3, '0.160'), row(4, '0.161')];
  const result = await bestCollectiveCombinations(rows, '0.300');
  assert.equal(result[0].quantity, 300n);
  assert.equal(result[0].category, 0);
  assert(result.some((match) => match.quantity === 360n && match.category === 1));
  assert(result.every((match) => match.quantity <= 360n));
  const boundary = await bestCollectiveCombinations(
    [row(1, '0.601'), row(2, '0.600'), row(3, '0.602')],
    '1.001',
  );
  assert(boundary.some((match) => match.quantity === 1201n && match.category === 1));
  assert(boundary.every((match) => match.quantity <= 1201n));
  assert.equal(
    scaledDecimal('999999999.999', 3) * scaledDecimal('9999999999.99', 2),
    999999999998000000000001n,
  );
});

test('collective results may use one farmer and count repeat listings only once per farmer', async () => {
  const singleFarmer = await bestCollectiveCombinations(
    [row(1, 60), row(2, 40, { farmerId: 'farmer-1' })],
    '100',
  );
  assert.equal(singleFarmer[0].farmerCount, 1);
  assert.equal(singleFarmer[0].members.length, 2);
  const result = await bestCollectiveCombinations(
    [row(1, 30), row(2, 30, { farmerId: 'farmer-1' }), row(3, 40)],
    '100',
  );
  assert.equal(result[0].farmerCount, 2);
  assert.equal(result[0].members.length, 3);
});

test('collective combinations have no fixed farmer cap and use whole lots', async () => {
  const result = await bestCollectiveCombinations(
    Array.from({ length: 40 }, (_, i) => row(i, 1)),
    '40',
  );
  assert.equal(result[0].category, 0);
  assert.equal(result[0].farmerCount, 40);
  assert.equal(result[0].members.length, 40);
  assert(result.every((match) => match.quantity === BigInt(match.members.length) * 1000n));
});

test('dates describe when all members are ready, default compares cost before farmer count, and sorting preserves fulfilment tiers', async () => {
  const result = await bestCollectiveCombinations(
    [
      row(1, 60, { availableDate: '2026-12-02' }),
      row(2, 40),
      row(3, 40, { pricePerUnit: '10.00' }),
      row(4, 20),
      row(5, 20),
    ],
    '100',
  );
  assert.equal(result[0].availableDate, '2026-12-01');
  assert.equal(result[0].category, 0);
  const price = await bestCollectiveCombinations(
    [row(1, 60), row(2, 40), row(3, 1, { pricePerUnit: '0.01' })],
    '100',
    'price_asc',
  );
  assert.equal(price[0].category, 0);
  assert.equal(price.at(-1).category, 2);
});

test('administrative proximity compares different farmers and does not mistake same-named upazilas across districts', () => {
  const result = administrativeProximity([
    row(1, 1),
    row(2, 1),
    row(3, 1, { district: 'চাঁপাইনবাবগঞ্জ' }),
    row(4, 1, { farmerId: 'farmer-1' }),
  ]);
  assert.equal(result.pairs, 5);
  assert.equal(result.sameUpazilaPairs, 2);
  assert.equal(result.differentDistrictPairs, 3);
  assert.equal(result.sum, 6);
});

// Independently enumerate small fixtures as an oracle; the production search must keep
// exactly the same top five for each sort despite its pruning and exploration order.
test('bounded search agrees with exhaustive subsets for all sorts, including administrative proximity', async () => {
  let seed = 321;
  const random = (max) => {
    seed = (seed * 16807) % 2147483647;
    return seed % max;
  };
  for (let trial = 0; trial < 20; trial++) {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row(i, 1 + random(9), {
        farmerId: `f${random(5)}`,
        pricePerUnit: `${1 + random(20)}.00`,
        availableDate: `2026-12-0${1 + random(3)}`,
        harvestDate: `2026-11-2${5 + random(3)}`,
        district: `d${random(2)}`,
        upazila: `u${random(2)}`,
      }),
    );
    const candidates = [];
    for (let mask = 1; mask < 2 ** rows.length; mask++) {
      const members = rows.filter((_, i) => mask & (1 << i)),
        quantity = members.reduce((s, r) => s + Number(r.quantity), 0);
      const farmers = new Set(members.map((r) => r.farmerId)).size;
      if (quantity > 12) continue;
      let pairs = 0,
        spread = 0;
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++) {
          if (members[i].farmerId === members[j].farmerId) continue;
          pairs++;
          spread +=
            members[i].district !== members[j].district
              ? 2
              : members[i].upazila !== members[j].upazila
                ? 1
                : 0;
        }
      candidates.push({
        key: members.map((r) => r.id).join(':'),
        category: quantity === 10 ? 0 : quantity > 10 ? 1 : 2,
        available: members
          .map((r) => r.availableDate)
          .sort()
          .at(-1),
        harvest: members
          .map((r) => r.harvestDate)
          .sort()
          .at(-1),
        cost: members.reduce((s, r) => s + Number(r.quantity) * Number(r.pricePerUnit), 0),
        farmers,
        spread: pairs ? spread / pairs : 0,
      });
    }
    for (const sort of collectiveMatchSorts) {
      const fields = ['available', 'harvest', 'cost', 'farmers', 'spread'];
      const preferred = {
        price_asc: 'cost',
        available_asc: 'available',
        harvest_asc: 'harvest',
        farmers_asc: 'farmers',
        proximity_asc: 'spread',
      }[sort];
      const order = preferred ? [preferred, ...fields.filter((f) => f !== preferred)] : fields;
      const expected = [...candidates]
        .sort((a, b) => {
          for (const key of ['category', ...order, 'key']) {
            if (a[key] < b[key]) return -1;
            if (a[key] > b[key]) return 1;
          }
          return 0;
        })
        .slice(0, 5)
        .map((c) => c.key);
      const actual = await bestCollectiveCombinations(rows, '10', sort);
      assert.deepEqual(
        actual.map((c) => c.key),
        expected,
        `trial ${trial}, ${sort}`,
      );
    }
  }
});

test('expensive searches yield and fail explicitly instead of returning a sampled top five', async () => {
  await assert.rejects(
    bestCollectiveCombinations(
      Array.from({ length: 30 }, (_, i) => row(i, 1)),
      '15',
      'recommended',
      { timeoutMs: 0 },
    ),
    (error) => error.status === 503,
  );
});

test('collective sorting accepts only a single supported sort; requirement overrides and page injection fail', () => {
  assert.deepEqual(collectiveMatchQuery(), { sort: 'recommended' });
  for (const query of [
    { quantity: '0' },
    { page: '1' },
    { farmerLimit: '2' },
    { sort: 'constructor' },
    { sort: ['price_asc'] },
  ])
    assert.throws(
      () => collectiveMatchQuery(query),
      (error) => error.status === 422,
    );
});
