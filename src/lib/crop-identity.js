import { cropSelection, resolveCropName } from '../../shared/crop-catalog.js';

export function validateCrop(input, fields, existing) {
  // Older clients send just a name. Accept known aliases and preserve existing
  // unclassified records when their owner edits another field.
  const varietyId = input.varietyId === '' ? null : input.varietyId;
  const selection = input.cropId === undefined && varietyId == null
    ? resolveCropName(input.cropName)
    : cropSelection(input.cropId, varietyId);
  if (selection) return selection;
  if (existing && !existing.cropId && !input.cropId && !varietyId && existing.cropName === input.cropName)
    return { cropId: null, varietyId: null, cropName: existing.cropName };
  fields.cropName = 'তালিকা থেকে ফসল ও উপযুক্ত জাত বেছে নিন।';
  return {};
}

export function matchingCropWhere(record) {
  // Snapshots created before the catalog have only the original display name.
  const identity = record.cropId === undefined ? resolveCropName(record.cropName) : record;
  if (identity?.cropId) {
    return { cropId: identity.cropId, ...(identity.varietyId ? { varietyId: identity.varietyId } : {}) };
  }
  return { cropId: null, cropName: record.cropName };
}
