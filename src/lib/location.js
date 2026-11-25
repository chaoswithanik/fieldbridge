import { col, fn, Op, where } from 'sequelize';
import { districts, allUpazilas, findPlace, searchPlaces } from '../../shared/geography/index.js';

export function validateLocation(input, fields, existing) {
  const district = findPlace(districts, input.district);
  const upazila = district && findPlace(district.upazilas, input.upazila);
  if (district && upazila) return { district: district.bn, upazila: upazila.bn };
  if (existing && existing.district === input.district && existing.upazila === input.upazila)
    return { district: existing.district, upazila: existing.upazila };
  if (!district) fields.district = 'তালিকা থেকে জেলা বেছে নিন।';
  if (!upazila) fields.upazila = 'নির্বাচিত জেলার একটি উপজেলা বেছে নিন।';
  return {};
}

// Existing listings may store either script. Older search URLs may also use
// partial text or an unlisted spelling, so keep literal substring discovery.
export function listingLocationConditions(query) {
  const district = findPlace(districts, query.district);
  const conditions = [];
  for (const [field, options] of [
    ['district', districts],
    ['upazila', district?.upazilas ?? allUpazilas],
  ]) {
    const text = query[field];
    if (!text) continue;
    const exact = searchPlaces(options, text, { exact: true });
    const matches = exact.length ? exact : searchPlaces(options, text);
    const names = [...new Set(matches.flatMap((p) => p.names))];
    if (exact.length) {
      conditions.push({ [field]: { [Op.in]: names } });
      continue;
    }
    const literal = where(fn('LOCATE', text, col(`CropListing.${field}`)), { [Op.gt]: 0 });
    conditions.push(names.length ? { [Op.or]: [literal, { [field]: { [Op.in]: names } }] } : literal);
  }
  return conditions;
}
