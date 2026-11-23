import { AppError } from './errors.js';
import { normalizeDigits } from './validation.js';
import { listingUnits } from './listing-validation.js';

const queryKeys = [
  'q',
  'district',
  'upazila',
  'unit',
  'minQuantity',
  'maxQuantity',
  'minPrice',
  'maxPrice',
  'harvestFrom',
  'harvestTo',
  'availableFrom',
  'availableTo',
  'sort',
  'page',
];
const sorts = [
  'newest',
  'available_asc',
  'harvest_asc',
  'price_asc',
  'price_desc',
  'quantity_desc',
];

export function canViewMarketDetails(user) {
  return (
    user?.role === 'admin' || (user?.role === 'buyer' && user.buyerProfile?.status === 'approved')
  );
}

export function marketplaceQuery(input = {}, canViewPrices = false) {
  const fields = {},
    values = {};
  if (
    Object.keys(input).some((key) => !queryKeys.includes(key)) ||
    Object.values(input).some((value) => typeof value !== 'string')
  )
    throw new AppError(422, 'খোঁজার তথ্য সঠিক নয়।');
  for (const [key, max] of [
    ['q', 100],
    ['district', 80],
    ['upazila', 80],
  ]) {
    values[key] = (input[key] || '').trim();
    if (values[key].length > max) fields[key] = 'খোঁজার লেখাটি আরও সংক্ষিপ্ত করুন।';
  }
  values.unit = input.unit || '';
  if (values.unit && !listingUnits.includes(values.unit)) fields.unit = 'একটি সঠিক একক বেছে নিন।';
  values.sort = input.sort || 'newest';
  if (!sorts.includes(values.sort)) fields.sort = 'সাজানোর ধরন সঠিক নয়।';
  const priceQuery =
    ['minPrice', 'maxPrice'].some((key) => Boolean(input[key]?.trim())) ||
    values.sort.startsWith('price_');
  if (priceQuery && !canViewPrices)
    throw new AppError(403, 'দাম দিয়ে খোঁজা বা সাজানোর জন্য অনুমোদিত ক্রেতা হিসেবে প্রবেশ করুন।');
  for (const [key, integerDigits, decimals] of [
    ['minQuantity', 9, 3],
    ['maxQuantity', 9, 3],
    ['minPrice', 10, 2],
    ['maxPrice', 10, 2],
  ]) {
    const raw = normalizeDigits(input[key] || '').trim();
    if (!raw) continue;
    if (!new RegExp(`^(?:0|[1-9]\\d{0,${integerDigits - 1}})(?:\\.\\d{1,${decimals}})?$`).test(raw))
      fields[key] = `${key.includes('Quantity') ? 'পরিমাণ' : 'দাম'} সঠিক সংখ্যায় লিখুন।`;
    else values[key] = raw;
    if (values.unit === 'piece' && key.includes('Quantity') && Number(raw) % 1 !== 0)
      fields[key] = 'পিসের পরিমাণ পূর্ণসংখ্যায় লিখুন।';
  }
  if (
    !values.unit &&
    (priceQuery ||
      values.minQuantity !== undefined ||
      values.maxQuantity !== undefined ||
      values.sort === 'quantity_desc')
  )
    fields.unit = 'দাম বা পরিমাণ তুলনা করতে আগে একটি একক বেছে নিন।';
  for (const [min, max] of [
    ['minQuantity', 'maxQuantity'],
    ['minPrice', 'maxPrice'],
  ])
    if (
      values[min] !== undefined &&
      values[max] !== undefined &&
      Number(values[min]) > Number(values[max])
    )
      fields[max] = 'সর্বোচ্চ মান সর্বনিম্ন মানের চেয়ে ছোট হতে পারে না।';
  for (const key of ['harvestFrom', 'harvestTo', 'availableFrom', 'availableTo']) {
    if (!input[key]) continue;
    const value = input[key],
      date = new Date(`${value}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value < '1900-01-01' ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      fields[key] = 'একটি সঠিক তারিখ বেছে নিন।';
    else values[key] = value;
  }
  for (const [from, to] of [
    ['harvestFrom', 'harvestTo'],
    ['availableFrom', 'availableTo'],
  ])
    if (values[from] && values[to] && values[from] > values[to])
      fields[to] = 'শেষ তারিখ শুরুর তারিখের আগে হতে পারে না।';
  const page = normalizeDigits(input.page || '1');
  if (!/^[1-9]\d{0,5}$/.test(page) || Number(page) > 100000) fields.page = 'পাতার নম্বর সঠিক নয়।';
  values.page = Number(page);
  if (Object.keys(fields).length)
    throw new AppError(422, 'ফিল্টারের চিহ্নিত তথ্যগুলো ঠিক করুন।', fields);
  return values;
}
