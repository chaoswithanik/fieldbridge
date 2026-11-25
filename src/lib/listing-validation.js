import { validateLocation } from './location.js';
import { validateCrop } from './crop-identity.js';
import { AppError } from './errors.js';
import { normalizeDigits } from './validation.js';

export const listingUnits = ['kg', 'ton', 'piece'];
export const listingStatuses = ['active', 'inactive', 'sold_out'];
export const photoFilenamePattern = /^[a-f0-9-]{36}\.webp$/;

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    value >= '1900-01-01' &&
    value <= '9999-12-31' &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function validateListing(input = {}, { soldOut = false, existing } = {}) {
  const fields = {};
  const values = { ...validateCrop(input, fields, existing), ...validateLocation(input, fields, existing) };
  for (const [key, label, min, max] of [
    ['farmAddress', 'খামারের ঠিকানা', 5, 500],
    ['description', 'বিবরণ', 5, 2000],
  ]) {
    values[key] = typeof input[key] === 'string' ? input[key].trim() : '';
    if (values[key].length < min || values[key].length > max)
      fields[key] =
        `${label} ${String(min).replace(/\d/g, (n) => '০১২৩৪৫৬৭৮৯'[n])} থেকে ${String(max).replace(/\d/g, (n) => '০১২৩৪৫৬৭৮৯'[n])} অক্ষরে লিখুন।`;
  }
  for (const [key, integerDigits, decimalDigits, label] of [
    ['quantity', 9, 3, 'পরিমাণ'],
    ['pricePerUnit', 10, 2, 'দাম'],
  ]) {
    const raw =
      typeof input[key] === 'string' || typeof input[key] === 'number'
        ? normalizeDigits(input[key]).trim()
        : '';
    const pattern = new RegExp(
      `^(?:0|[1-9]\\d{0,${integerDigits - 1}})(?:\\.\\d{1,${decimalDigits}})?$`,
    );
    const zeroAllowed = key === 'quantity' && soldOut;
    if (!pattern.test(raw) || (!zeroAllowed && Number(raw) <= 0))
      fields[key] =
        `${label} ${zeroAllowed ? 'শূন্য বা তার বেশি' : 'শূন্যের বেশি'} লিখুন; ${key === 'quantity' ? 'সর্বোচ্চ ৯টি পূর্ণসংখ্যা ও ৩টি দশমিক' : 'সর্বোচ্চ ১০টি পূর্ণসংখ্যা ও ২টি দশমিক'} ব্যবহার করুন।`;
    values[key] = raw;
  }
  values.unit = input.unit;
  if (!listingUnits.includes(values.unit)) fields.unit = 'কেজি, মেট্রিক টন অথবা পিস বেছে নিন।';
  if (values.unit === 'piece' && Number(values.quantity) % 1 !== 0)
    fields.quantity = 'পিস হিসেবে পরিমাণ পূর্ণসংখ্যায় লিখুন।';
  for (const [key, label] of [
    ['harvestDate', 'ফসল কাটার তারিখ'],
    ['availableDate', 'সরবরাহের তারিখ'],
  ]) {
    values[key] = input[key];
    if (!validDate(values[key])) fields[key] = `${label} সঠিকভাবে দিন।`;
  }
  if (!fields.harvestDate && !fields.availableDate && values.availableDate < values.harvestDate)
    fields.availableDate = 'সরবরাহের তারিখ ফসল কাটার তারিখের আগে হতে পারে না।';
  if (Object.keys(fields).length)
    throw new AppError(422, 'চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।', fields);
  return values;
}

export function listingVersion(value) {
  const raw = normalizeDigits(value);
  if (!/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > 4294967294)
    throw new AppError(422, 'বিজ্ঞাপনটি আবার খুলে চেষ্টা করুন।');
  return Number(raw);
}

export function retainedPhotos(value) {
  let photos = value;
  if (typeof photos === 'string') {
    try {
      photos = JSON.parse(photos);
    } catch {
      photos = null;
    }
  }
  if (
    !Array.isArray(photos) ||
    photos.length > 5 ||
    photos.some((name) => typeof name !== 'string' || !photoFilenamePattern.test(name)) ||
    new Set(photos).size !== photos.length
  )
    throw new AppError(422, 'ছবির তালিকা সঠিক নয়।', { photos: 'বিজ্ঞাপনটি আবার খুলে ছবি বেছে নিন।' });
  return photos;
}
