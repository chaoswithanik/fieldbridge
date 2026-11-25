import { performance } from 'node:perf_hooks';
import { setImmediate } from 'node:timers/promises';
import { AppError } from './errors.js';

// Keep DECIMAL quantities exact. Round each listing's cost to paisa before summing.
export function scaledDecimal(value, places) {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'));
}
export function decimalString(value, places) {
  const digits = value.toString().padStart(places + 1, '0');
  return `${digits.slice(0, -places)}.${digits.slice(-places)}`;
}
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const defaultFactors = ['availableDate', 'harvestDate', 'cost', 'farmerCount', 'proximity'];
const sortFactors = {
  price_asc: 'cost',
  available_asc: 'availableDate',
  harvest_asc: 'harvestDate',
  farmers_asc: 'farmerCount',
  proximity_asc: 'proximity',
};

function compareProximity(a, b) {
  return compare(BigInt(a.sum) * BigInt(b.pairs), BigInt(b.sum) * BigInt(a.pairs));
}

export function administrativeProximity(members) {
  const pairsInGroups = (keys) => {
    const counts = new Map();
    for (const key of keys) counts.set(key, (counts.get(key) || 0) + 1);
    return [...counts.values()].reduce((sum, count) => sum + (count * (count - 1)) / 2, 0);
  };
  const place = (member, upazila = false) =>
    JSON.stringify([
      member.district.normalize('NFC').trim(),
      ...(upazila ? [member.upazila.normalize('NFC').trim()] : []),
    ]);
  const pairs =
    (members.length * (members.length - 1)) / 2 - pairsInGroups(members.map((m) => m.farmerId));
  const sameDistrict =
    pairsInGroups(members.map((m) => place(m))) -
    pairsInGroups(members.map((m) => `${m.farmerId}:${place(m)}`));
  const sameUpazila =
    pairsInGroups(members.map((m) => place(m, true))) -
    pairsInGroups(members.map((m) => `${m.farmerId}:${place(m, true)}`));
  const differentDistrict = pairs - sameDistrict,
    sameDistrictOnly = sameDistrict - sameUpazila;
  return {
    sum: differentDistrict * 2 + sameDistrictOnly,
    pairs: pairs || 1,
    sameUpazilaPairs: sameUpazila,
    sameDistrictPairs: sameDistrictOnly,
    differentDistrictPairs: differentDistrict,
  };
}
export function combinationComparator(sort = 'recommended') {
  const first = sortFactors[sort];
  const factors = first
    ? [first, ...defaultFactors.filter((factor) => factor !== first)]
    : defaultFactors;
  return (a, b) => {
    const category = compare(a.category, b.category);
    if (category) return category;
    for (const factor of factors) {
      const difference =
        factor === 'proximity'
          ? compareProximity(a.proximity, b.proximity)
          : compare(a[factor], b[factor]);
      if (difference) return difference;
    }
    return compare(a.key, b.key);
  };
}

// Use the larger lots first when drawing a requested amount from one farm.
// The ID tie-break makes the allocation identical during matching and checkout.
function orderedLots(listings) {
  return listings.map((listing) => ({
    listing,
    quantity: scaledDecimal(listing.quantity, 3),
    price: scaledDecimal(listing.pricePerUnit, 2),
  })).sort((a, b) => compare(b.quantity, a.quantity) || compare(a.listing.id, b.listing.id));
}

export function requirementLotQuantities(listings, requested) {
  const singleFarm = listings.every((row) => row.farmerId === listings[0].farmerId);
  let remaining = scaledDecimal(requested, 3);
  const amounts = new Map();
  for (const { listing, quantity } of orderedLots(listings)) {
    const amount = singleFarm && remaining < quantity ? remaining : quantity;
    amounts.set(listing.id, amount);
    remaining -= amount;
  }
  return amounts;
}

// Searches listing lots from one or more farmers. No farmer/listing cap.
// Bounds discard only branches that cannot improve the proven top five. Work yields to
// HTTP handling; if exhaustive ranking cannot finish, fail explicitly instead of calling
// a truncated candidate sample the best results.
export async function bestCollectiveCombinations(
  listings,
  requested,
  sort = 'recommended',
  { proximity = administrativeProximity, timeoutMs = 3000, prioritizeSingleFarm = false } = {},
) {
  const target = scaledDecimal(requested, 3),
    maximum = (target * 6n) / 5n;
  const stock = orderedLots(listings).filter((row) => row.quantity > 0n);
  const wholeLots = stock.filter((row) => row.quantity <= maximum);
  const comparator = combinationComparator(sort),
    results = [],
    started = performance.now();
  let operations = 0;
  const phases = [
    [0, target, target],
    [1, target + 1n, maximum],
    [2, 1n, target - 1n],
  ];
  if (prioritizeSingleFarm) phases.unshift([0, target, target, true]);
  for (const [category, minimum, upper, singleFarmOnly] of phases) {
    const rows = singleFarmOnly
      ? [...stock].sort((a, b) => compare(a.listing.farmerId, b.listing.farmerId))
      : wholeLots;
    const suffix = Array(rows.length + 1).fill(0n);
    for (let i = rows.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + rows[i].quantity;
    if (results.length === 5 || upper < minimum || suffix[0] < minimum) continue;
    const phase = [],
      selected = [],
      farmers = new Map();
    const stack = [];
    // Each priority branch searches one farmer's lots and can stop immediately
    // when that farmer has insufficient stock across all their listings.
    for (let start = 0; start < rows.length;) {
      let end = rows.length;
      if (singleFarmOnly) {
        end = start + 1;
        while (end < rows.length && rows[end].listing.farmerId === rows[start].listing.farmerId) end++;
      }
      if (suffix[start] - suffix[end] >= minimum)
        stack.push({ next: start, end, quantity: 0n, cost: 0n, availableDate: '', harvestDate: '' });
      start = end;
    }
    while (stack.length) {
      if (++operations % 1024 === 0) {
        await setImmediate();
        if (performance.now() - started >= timeoutMs)
          throw new AppError(
            503,
            'সব সমন্বয় তুলনা করতে বেশি সময় লাগছে। সেরা ফল নিশ্চিত করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
          );
      }
      const parent = stack.at(-1);
      if (parent.next === parent.end) {
        stack.pop();
        if (selected.length) {
          const id = rows[selected.pop()].listing.farmerId,
            count = farmers.get(id) - 1;
          if (count) farmers.set(id, count);
          else farmers.delete(id);
        }
        continue;
      }
      const index = parent.next++;
      const row = rows[index];
      const remaining = target - parent.quantity;
      const take = singleFarmOnly && remaining < row.quantity ? remaining : row.quantity;
      const quantity = parent.quantity + take;
      if (quantity > upper || quantity + suffix[index + 1] - suffix[parent.end] < minimum) continue;
      const cost = parent.cost + (take * row.price + 500n) / 1000n;
      const availableDate =
        parent.availableDate > row.listing.availableDate
          ? parent.availableDate
          : row.listing.availableDate;
      const harvestDate =
        parent.harvestDate > row.listing.harvestDate ? parent.harvestDate : row.listing.harvestDate;
      const farmerCount = farmers.size + (farmers.has(row.listing.farmerId) ? 0 : 1);
      const bound = {
        category,
        cost,
        availableDate,
        harvestDate,
        farmerCount,
        proximity: { sum: 0, pairs: 1 },
        key: '',
      };
      if (phase.length === 5 - results.length && comparator(bound, phase.at(-1)) > 0) continue;
      selected.push(index);
      farmers.set(row.listing.farmerId, (farmers.get(row.listing.farmerId) || 0) + 1);
      // A complete one-farm selection has already competed in the priority phase.
      const alreadyRanked = prioritizeSingleFarm && !singleFarmOnly && category !== 2 && farmerCount === 1;
      if (quantity >= minimum && !alreadyRanked) {
        const members = selected.map((i) => rows[i].listing).sort((a, b) => compare(a.id, b.id));
        phase.push({
          category,
          quantity,
          cost,
          availableDate,
          harvestDate,
          farmerCount,
          members,
          proximity: proximity ? proximity(members) : { sum: 0, pairs: 1 },
          key: members.map((member) => member.id).join(':'),
        });
        phase.sort(comparator);
        if (phase.length > 5 - results.length) phase.pop();
      }
      stack.push({
        end: parent.end,
        next: quantity === upper ? parent.end : index + 1,
        quantity,
        cost,
        availableDate,
        harvestDate,
      });
    }
    results.push(...phase);
  }
  return results;
}
