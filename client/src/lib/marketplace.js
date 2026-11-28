export { useApiResource as useMarketResource } from './resource.js';

export const marketFilterKeys = [
  'q',
  'category',
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
];
export const emptyMarketFilters = Object.fromEntries(marketFilterKeys.map((key) => [key, '']));
