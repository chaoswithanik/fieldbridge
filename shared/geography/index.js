import data from './bangladesh.json' with { type: 'json' };

// Keep familiar spellings searchable, including names already used by demo farmers.
const alternateNames = {
  Bogura: ['Bogra'],
  Comilla: ['Cumilla'],
  Chattogram: ['Chittagong'],
  Barisal: ['Barishal'],
  Jashore: ['Jessore'],
  Coxsbazar: ["Cox's Bazar"],
  'Bogra Sadar': ['Bogura Sadar'],
  'Comilla Sadar': ['Cumilla Sadar'],
  'Jessore Sadar': ['Jashore Sadar'],
  'Barisal Sadar': ['Barishal Sadar'],
  Pirgonj: ['Pirganj'],
  Taragonj: ['Taraganj'],
  Badargonj: ['Badarganj'],
  Keraniganj: ['কেরানীগঞ্জ'],
};

function searchKey(value) {
  return (typeof value === 'string' ? value : '').normalize('NFC').toLowerCase()
    .replace(/[\s'’\-\u200b-\u200d]/gu, '');
}

function place(bn, en, district) {
  const aliases = alternateNames[en] || [];
  const displayName = en === 'Gangachara' ? 'গঙ্গাচড়া' : bn;
  const names = [...new Set([displayName, bn, en, ...aliases])];
  return { bn: displayName, en, district, names, keys: names.map(searchKey) };
}
const byName = (a, b) => a.bn.localeCompare(b.bn, 'bn');
export const districts = data.map(({ bn, en, upazilas }) => ({
  ...place(bn, en), upazilas: upazilas.map(([bnName, enName]) => place(bnName, enName, bn)).sort(byName),
})).sort(byName);
export const allUpazilas = districts.flatMap((d) => d.upazilas).sort(byName);

export function findPlace(options, value) {
  const key = searchKey(value);
  return key ? options.find((p) => p.keys.includes(key)) : undefined;
}
export function searchPlaces(options, query, { exact = false } = {}) {
  const key = searchKey(query);
  if (!query.trim()) return options;
  return key ? options.filter((p) => exact ? p.keys.includes(key) : p.keys.some((name) => name.includes(key))) : [];
}
