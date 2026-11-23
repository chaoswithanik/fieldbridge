import { AppError } from './errors.js';
export const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function onlyOrderFields(input, keys) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new AppError(422, 'অর্ডারের তথ্য সঠিক নয়।');
}
export function orderSelection(input) {
  onlyOrderFields(input, ['requirementId', 'listingIds']);
  if (
    typeof input.requirementId !== 'string' ||
    !uuidPattern.test(input.requirementId) ||
    !Array.isArray(input.listingIds) ||
    !input.listingIds.length ||
    input.listingIds.some((id) => typeof id !== 'string' || !uuidPattern.test(id)) ||
    new Set(input.listingIds).size !== input.listingIds.length
  )
    throw new AppError(422, 'নিজের চাহিদা ও আলাদা ফসলের বিজ্ঞাপন বেছে নিন।');
  return { requirementId: input.requirementId, listingIds: [...input.listingIds].sort() };
}
export function orderSubmission(input) {
  onlyOrderFields(input, ['quoteToken', 'requestId']);
  if (
    typeof input.quoteToken !== 'string' ||
    !input.quoteToken ||
    input.quoteToken.length > 900000 ||
    typeof input.requestId !== 'string' ||
    !uuidPattern.test(input.requestId)
  )
    throw new AppError(422, 'অর্ডারের সর্বশেষ তথ্য আবার খুলে নিশ্চিত করুন।');
  return input;
}
export function orderDecision(input) {
  onlyOrderFields(input, ['decision', 'version']);
  if (
    !['accepted', 'rejected'].includes(input.decision) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 1
  )
    throw new AppError(422, 'গ্রহণ বা প্রত্যাখ্যান বেছে নিয়ে সর্বশেষ তথ্য দিয়ে চেষ্টা করুন।');
  return input;
}
export function privatePage(query = {}) {
  if (
    Object.keys(query).some((key) => key !== 'page') ||
    (query.page !== undefined &&
      (typeof query.page !== 'string' ||
        !/^[1-9]\d{0,5}$/.test(query.page) ||
        Number(query.page) > 100000))
  )
    throw new AppError(422, 'পাতার নম্বর সঠিক নয়।');
  return Number(query.page || 1);
}
