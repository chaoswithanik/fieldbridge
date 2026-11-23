import { AppError } from './errors.js';
import { normalizeDigits } from './validation.js';

export const individualMatchSorts = {
  available_asc: ['availableDate', 'ASC'],
  harvest_asc: ['harvestDate', 'ASC'],
  price_asc: ['pricePerUnit', 'ASC'],
  price_desc: ['pricePerUnit', 'DESC'],
};

export function individualMatchQuery(input = {}) {
  if (
    Object.keys(input).some((key) => !['sort', 'page'].includes(key)) ||
    Object.values(input).some((value) => typeof value !== 'string')
  )
    throw new AppError(422, 'এখানে শুধু সাজানোর ধরন ও পাতার নম্বর দেওয়া যাবে।');
  const sort = input.sort || 'available_asc',
    page = normalizeDigits(input.page || '1');
  if (!Object.hasOwn(individualMatchSorts, sort)) throw new AppError(422, 'সাজানোর ধরন সঠিক নয়।');
  if (!/^[1-9]\d{0,5}$/.test(page) || Number(page) > 100000)
    throw new AppError(422, 'পাতার নম্বর সঠিক নয়।');
  return { sort, page: Number(page) };
}
