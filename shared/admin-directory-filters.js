import { cropCatalog } from './crop-catalog.js';
import { districts } from './geography/index.js';

const roles = [['farmer', 'কৃষক'], ['buyer', 'ক্রেতা']];
const active = [['active', 'চালু'], ['inactive', 'বন্ধ']];
const crop = { key: 'crop', label: 'ফসল', options: cropCatalog.map(c => [c.id, c.name]) };
const unit = { key: 'unit', label: 'একক', options: [['kg', 'কেজি'], ['ton', 'মেট্রিক টন'], ['piece', 'পিস']] };

export const directoryFilters = {
  users: [
    { key: 'filter', label: 'ভূমিকা', options: roles },
    { key: 'access', label: 'অ্যাকাউন্টে প্রবেশ', options: [['allowed', 'চালু'], ['blocked', 'বন্ধ']] },
  ],
  listings: [
    { key: 'filter', label: 'বিজ্ঞাপনের অবস্থা', options: [...active, ['sold_out', 'বিক্রি শেষ']] },
    { key: 'visibility', label: 'অ্যাডমিন নিয়ন্ত্রণ', options: [['visible', 'আড়াল করা হয়নি'], ['hidden', 'আড়াল করা']] },
    crop, unit, { key: 'district', label: 'জেলা', options: districts.map(d => [d.bn, d.bn]) },
  ],
  requirements: [
    { key: 'filter', label: 'চাহিদার অবস্থা', options: [...active, ['fulfilled', 'পূরণ হয়েছে']] }, crop, unit,
  ],
  orders: [
    { key: 'filter', label: 'অর্ডারের অবস্থা', options: [['open', 'চলমান'], ['completed', 'সম্পন্ন']] },
    { key: 'mode', label: 'সরবরাহের ধরন', options: [['individual', 'একক'], ['collective', 'সম্মিলিত']] },
  ],
};

// Preserve links from the original single-filter controls.
export function normalizeDirectoryFilters(section, values) {
  const result = { ...values };
  if (section === 'users' && result.filter === 'blocked') {
    result.access = 'blocked';
    delete result.filter;
  }
  if (section === 'listings' && result.filter === 'hidden') {
    result.visibility = 'hidden';
    delete result.filter;
  }
  return result;
}
