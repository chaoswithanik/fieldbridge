import { AppError } from './errors.js';
import { onlyOrderFields, uuidPattern, privatePage } from './order-validation.js';
export function replacementSelection(input) {
  onlyOrderFields(input, ['listingIds']);
  if (
    !Array.isArray(input.listingIds) ||
    !input.listingIds.length ||
    input.listingIds.some((id) => typeof id !== 'string' || !uuidPattern.test(id)) ||
    new Set(input.listingIds).size !== input.listingIds.length
  )
    throw new AppError(422, 'আলাদা ফসলের বিজ্ঞাপন বেছে নিন।');
  return [...input.listingIds].sort();
}
export const replacementListingSorts = {
  available_asc: ['availableDate', 'ASC'],
  price_asc: ['pricePerUnit', 'ASC'],
  quantity_desc: ['quantity', 'DESC'],
};
export function replacementListingQuery(input = {}) {
  if (
    Object.keys(input).some((key) => !['page', 'sort', 'district', 'upazila'].includes(key)) ||
    Object.values(input).some((value) => typeof value !== 'string')
  )
    throw new AppError(422, 'বিকল্প ফসলের বাছাইয়ের তথ্য সঠিক নয়।');
  const sort = input.sort || 'available_asc',
    district = (input.district || '').trim().normalize('NFC'),
    upazila = (input.upazila || '').trim().normalize('NFC');
  if (!Object.hasOwn(replacementListingSorts, sort) || district.length > 80 || upazila.length > 80)
    throw new AppError(422, 'সাজানো বা অবস্থানের তথ্য সঠিক নয়।');
  return {
    sort,
    district,
    upazila,
    page: privatePage(input.page === undefined ? {} : { page: input.page }),
  };
}
