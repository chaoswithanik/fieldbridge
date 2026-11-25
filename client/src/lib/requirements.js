import { bangla, digits } from './registration.js';

export const requirementLabels = {
  active: 'চালু',
  inactive: 'সাময়িক বন্ধ',
  fulfilled: 'পূরণ হয়েছে',
};
export function requirementErrors(form) {
  const fields = {};
  if (!form.cropId) fields.cropName = 'তালিকা থেকে ফসল বেছে নিন।';
  for (const [key, label, min, max] of [
    ['deliveryAddress', 'ডেলিভারির পূর্ণ ঠিকানা', 5, 500],
  ])
    if (form[key].trim().length < min || form[key].trim().length > max)
      fields[key] = `${label} ${bangla(min)} থেকে ${bangla(max)} অক্ষরে লিখুন।`;
  const quantity = digits(form.quantity).trim();
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0)
    fields.quantity = 'পরিমাণ শূন্যের বেশি লিখুন; সর্বোচ্চ ৯টি পূর্ণসংখ্যা ও ৩ ঘর দশমিক।';
  if (form.unit === 'piece' && Number(quantity) % 1 !== 0)
    fields.quantity = 'পিসের পরিমাণ পূর্ণসংখ্যায় লিখুন।';
  if (form.instructions.trim().length > 2000)
    fields.instructions = 'নির্দেশনা সর্বোচ্চ ২০০০ অক্ষরে লিখুন।';
  return fields;
}
