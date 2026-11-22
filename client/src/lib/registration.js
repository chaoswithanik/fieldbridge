export const bangla = (value) => String(value).replace(/\d/g, (digit) => '০১২৩৪৫৬৭৮৯'[digit]);
export const digits = (value) =>
  String(value ?? '').replace(/[০-৯]/g, (digit) => '০১২৩৪৫৬৭৮৯'.indexOf(digit));
export function phoneNumber(value) {
  let phone = digits(value).replace(/[\s()-]/g, '');
  if (phone.startsWith('+880')) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith('880')) phone = `0${phone.slice(3)}`;
  return phone;
}

export function registrationErrors(form, photo) {
  const errors = {};
  for (const [key, label, min, max] of [
    ['fullName', 'পুরো নাম', 2, 100],
    ['district', 'জেলা', 2, 80],
    ['upazila', 'উপজেলা', 2, 80],
    ['village', 'গ্রাম', 2, 100],
    ['farmAddress', 'খামারের ঠিকানা', 5, 500],
  ]) {
    if (form[key].trim().length < min || form[key].trim().length > max)
      errors[key] = `${label} ${bangla(min)} থেকে ${bangla(max)} অক্ষরে লিখুন।`;
  }
  if (!/^01[3-9]\d{8}$/.test(phoneNumber(form.phone)))
    errors.phone = 'বাংলাদেশের ১১ সংখ্যার মোবাইল নম্বর দিন।';
  if (!/^(?:\d{10}|\d{13}|\d{17})$/.test(digits(form.nid).replace(/\s/g, '')))
    errors.nid = '১০, ১৩ অথবা ১৭ সংখ্যার NID নম্বর দিন।';
  if (form.password.length < 8 || form.password.length > 128)
    errors.password = 'পাসওয়ার্ড ৮ থেকে ১২৮ অক্ষরের হতে হবে।';
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'দুটি পাসওয়ার্ড মিলছে না।';
  if (
    form.email.trim() &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 254)
  )
    errors.email = 'একটি সঠিক ইমেইল ঠিকানা দিন।';
  if (form.farmName.trim().length > 120) errors.farmName = 'খামারের নাম সর্বোচ্চ ১২০ অক্ষরে লিখুন।';
  if (
    photo &&
    (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) ||
      photo.size > 2 * 1024 * 1024)
  )
    errors.photo = 'JPG, PNG অথবা WebP ছবি দিন (সর্বোচ্চ ২ মেগাবাইট)।';
  return errors;
}
