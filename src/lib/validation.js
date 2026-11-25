import { validateLocation } from './location.js';
import { AppError } from './errors.js';

export function normalizeDigits(value) {
  return String(value ?? '').replace(/[০-৯]/g, (digit) => '০১২৩৪৫৬৭৮৯'.indexOf(digit));
}

export function normalizePhone(value) {
  let phone = normalizeDigits(value).replace(/[\s()-]/g, '');
  if (phone.startsWith('+880')) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith('880')) phone = `0${phone.slice(3)}`;
  return phone;
}

export function validPhone(value) {
  const phone = normalizePhone(value);
  if (!/^01[3-9]\d{8}$/.test(phone))
    throw new AppError(422, 'ফোন নম্বরটি সঠিক নয়।', {
      phone: 'বাংলাদেশের ১১ সংখ্যার মোবাইল নম্বর দিন।',
    });
  return phone;
}

function farmerDetails(input, fields, existing) {
  const values = validateLocation(input, fields, existing);
  for (const [key, label, min, max] of [
    ['fullName', 'পুরো নাম', 2, 100],
    ['village', 'গ্রাম', 2, 100],
    ['farmAddress', 'খামারের ঠিকানা', 5, 500],
  ]) {
    values[key] = typeof input[key] === 'string' ? input[key].trim() : '';
    if (values[key].length < min || values[key].length > max)
      fields[key] =
        `${label} ${min === 2 ? 'কমপক্ষে ২' : 'কমপক্ষে ৫'} অক্ষরে লিখুন (সর্বোচ্চ ${normalizeBangla(max)} অক্ষর)।`;
  }
  values.email = typeof input.email === 'string' ? input.email.trim().toLowerCase() || null : null;
  if (
    values.email &&
    (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
  )
    fields.email = 'একটি সঠিক ইমেইল ঠিকানা দিন।';
  values.farmName = typeof input.farmName === 'string' ? input.farmName.trim() || null : null;
  if (values.farmName && values.farmName.length > 120)
    fields.farmName = 'খামারের নাম সর্বোচ্চ ১২০ অক্ষরে লিখুন।';
  return values;
}

export function validateFarmerProfile(input = {}, existing) {
  const fields = {};
  const values = farmerDetails(input, fields, existing);
  if (Object.keys(fields).length)
    throw new AppError(422, 'চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।', fields);
  return values;
}

export function validateFarmer(input = {}) {
  const fields = {};
  const values = farmerDetails(input, fields);
  values.phone = normalizePhone(input.phone);
  if (!/^01[3-9]\d{8}$/.test(values.phone)) fields.phone = 'বাংলাদেশের ১১ সংখ্যার মোবাইল নম্বর দিন।';
  values.nid = normalizeDigits(input.nid).replace(/\s/g, '');
  if (!/^(?:\d{10}|\d{13}|\d{17})$/.test(values.nid))
    fields.nid = '১০, ১৩ অথবা ১৭ সংখ্যার NID নম্বর দিন।';
  values.password = typeof input.password === 'string' ? input.password : '';
  if (values.password.length < 8 || values.password.length > 128)
    fields.password = 'পাসওয়ার্ড ৮ থেকে ১২৮ অক্ষরের হতে হবে।';
  if (input.confirmPassword !== values.password) fields.confirmPassword = 'দুটি পাসওয়ার্ড মিলছে না।';
  if (Object.keys(fields).length)
    throw new AppError(422, 'চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।', fields);
  return values;
}

function normalizeBangla(value) {
  return String(value).replace(/\d/g, (digit) => '০১২৩৪৫৬৭৮৯'[digit]);
}
