import { bangla, digits } from './registration.js';

export const unitLabels = { kg: 'কেজি', ton: 'মেট্রিক টন', piece: 'পিস' };
export const statusLabels = { active: 'চালু', inactive: 'সাময়িক বন্ধ', sold_out: 'বিক্রি শেষ' };
export const formatAmount = (value) =>
  new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 3 }).format(Number(value));
export const formatDate = (value) =>
  new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(`${value}T00:00:00Z`));

export function listingErrors(form, photoCount, soldOut) {
  const errors = {};
  if (!form.cropId) errors.cropName = 'তালিকা থেকে ফসল বেছে নিন।';
  for (const [key, label, min, max] of [
    ['district', 'জেলা', 2, 80],
    ['upazila', 'উপজেলা', 2, 80],
    ['farmAddress', 'খামারের ঠিকানা', 5, 500],
    ['description', 'বিবরণ', 5, 2000],
  ]) {
    if (form[key].trim().length < min || form[key].trim().length > max)
      errors[key] = `${label} ${bangla(min)} থেকে ${bangla(max)} অক্ষরে লিখুন।`;
  }
  for (const [key, places, length] of [
    ['quantity', 3, 9],
    ['pricePerUnit', 2, 10],
  ]) {
    const value = digits(form[key]).trim();
    const zeroAllowed = key === 'quantity' && soldOut;
    if (
      !new RegExp(`^(?:0|[1-9]\\d{0,${length - 1}})(?:\\.\\d{1,${places}})?$`).test(value) ||
      (!zeroAllowed && Number(value) <= 0)
    )
      errors[key] =
        `${key === 'quantity' ? 'পরিমাণ' : 'দাম'} ${zeroAllowed ? 'শূন্য বা তার বেশি' : 'শূন্যের বেশি'} সঠিক সংখ্যায় লিখুন (সর্বোচ্চ ${bangla(places)} ঘর দশমিক)।`;
  }
  if (form.unit === 'piece' && Number(digits(form.quantity)) % 1 !== 0)
    errors.quantity = 'পিস হিসেবে পরিমাণ পূর্ণসংখ্যায় লিখুন।';
  for (const key of ['harvestDate', 'availableDate'])
    if (!form[key]) errors[key] = 'তারিখটি বেছে নিন।';
  if (form.availableDate && form.harvestDate && form.availableDate < form.harvestDate)
    errors.availableDate = 'সরবরাহের তারিখ ফসল কাটার তারিখের আগে হতে পারে না।';
  if (photoCount < 1 || photoCount > 5) errors.photos = 'অন্তত ১টি এবং সর্বোচ্চ ৫টি ছবি রাখুন।';
  return errors;
}
