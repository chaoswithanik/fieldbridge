// IDs are persisted in listings, requirements and order history.
const crop = (id, name, aliases, varieties = []) => ({ id, name, aliases, varieties });
const variety = (id, name, aliases) => ({ id, name, aliases });

export const cropCatalog = [
  crop('potato', 'আলু', ['potato', 'potatoes', 'alu', 'aloo'], [
    variety('red', 'লাল আলু', ['red potato', 'red potatoes', 'lal alu']),
    variety('white', 'সাদা আলু', ['white potato', 'shada alu']),
  ]),
  crop('sweet-potato', 'মিষ্টি আলু', ['মিষ্টিআলু', 'sweet potato', 'sweet potatoes', 'mishti alu']),
  crop('tomato', 'টমেটো', ['টমেটু', 'টমাটো', 'tomato', 'tomatoes']),
  crop('carrot', 'গাজর', ['carrot', 'carrots', 'gajor']),
  crop('pumpkin', 'মিষ্টিকুমড়া', ['মিষ্টি কুমড়া', 'কুমড়া', 'pumpkin', 'kumra']),
  crop('cucumber', 'শসা', ['cucumber', 'shosha']),
  crop('radish', 'মূলা', ['মুলা', 'radish', 'mula']),
  crop('corn', 'ভুট্টা', ['ভুট্টা শস্য', 'corn', 'maize', 'bhutta']),
  crop('paddy', 'ধান', ['paddy', 'dhan'], [
    variety('aman', 'আমন ধান', ['aman paddy', 'aman dhan']),
    variety('boro', 'বোরো ধান', ['বোরোধান', 'boro paddy', 'boro dhan']),
  ]),
];

function normalize(text) {
  return typeof text === 'string' ? text.normalize('NFC').trim().toLowerCase().replace(/\s+/gu, ' ') : '';
}

const entries = cropCatalog.flatMap(({ id, name, aliases, varieties }) => [
  { cropId: id, varietyId: null, cropName: name, terms: [name, ...aliases].map(normalize) },
  ...varieties.map((variety) => ({
    cropId: id, varietyId: variety.id, cropName: variety.name,
    terms: [variety.name, ...variety.aliases].map(normalize),
  })),
]);

export function cropSelection(cropId, varietyId = null) {
  const entry = entries.find((item) => item.cropId === cropId && item.varietyId === varietyId);
  return entry && { cropId, varietyId, cropName: entry.cropName };
}

export function resolveCropName(text) {
  const term = normalize(text);
  const matches = entries.filter((item) => item.terms.includes(term));
  if (matches.length === 1) return cropSelection(matches[0].cropId, matches[0].varietyId);
}

export function searchCropCatalog(text) {
  const term = normalize(text);
  return entries.filter((item) => item.terms.some((alias) => alias.includes(term)));
}
