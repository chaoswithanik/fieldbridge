import { AppError } from './errors.js';
import { normalizeDigits } from './validation.js';
import { listingUnits } from './listing-validation.js';

export const requirementStatuses = ['active', 'inactive', 'fulfilled'];
export const requirementFields = [
  'cropName',
  'quantity',
  'unit',
  'deliveryAddress',
  'instructions',
];

export function onlyRequirementFields(input, allowed) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key))
  )
    throw new AppError(422, 'শুধু চাহিদার নির্ধারিত তথ্য পাঠান।');
}

export function validateRequirement(input) {
  const fields = {},
    values = {};
  for (const [key, label, min, max] of [
    ['cropName', 'ফসলের নাম', 2, 100],
    ['deliveryAddress', 'ডেলিভারির পূর্ণ ঠিকানা', 5, 500],
  ]) {
    values[key] = typeof input[key] === 'string' ? input[key].trim() : '';
    if (values[key].length < min || values[key].length > max)
      fields[key] =
        `${label} ${String(min).replace(/\d/g, (n) => '০১২৩৪৫৬৭৮৯'[n])} থেকে ${String(max).replace(/\d/g, (n) => '০১২৩৪৫৬৭৮৯'[n])} অক্ষরে লিখুন।`;
  }
  values.quantity =
    typeof input.quantity === 'string' || typeof input.quantity === 'number'
      ? normalizeDigits(input.quantity).trim()
      : '';
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(values.quantity) || Number(values.quantity) <= 0)
    fields.quantity =
      'পরিমাণ শূন্যের বেশি লিখুন; সর্বোচ্চ ৯টি পূর্ণসংখ্যা ও ৩ ঘর দশমিক ব্যবহার করুন।';
  values.unit = input.unit;
  if (!listingUnits.includes(values.unit)) fields.unit = 'কেজি, মেট্রিক টন অথবা পিস বেছে নিন।';
  if (values.unit === 'piece' && Number(values.quantity) % 1 !== 0)
    fields.quantity = 'পিসের পরিমাণ পূর্ণসংখ্যায় লিখুন।';
  values.instructions =
    typeof input.instructions === 'string' ? input.instructions.trim() || null : null;
  if (input.instructions != null && typeof input.instructions !== 'string')
    fields.instructions = 'নির্দেশনা লেখায় দিন।';
  if (values.instructions?.length > 2000)
    fields.instructions = 'নির্দেশনা সর্বোচ্চ ২০০০ অক্ষরে লিখুন।';
  if (Object.keys(fields).length)
    throw new AppError(422, 'চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।', fields);
  return values;
}

export function requirementVersion(value) {
  const raw = normalizeDigits(value);
  if (!/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > 4294967294)
    throw new AppError(422, 'চাহিদার সর্বশেষ তথ্য আবার খুলে চেষ্টা করুন।');
  return Number(raw);
}
