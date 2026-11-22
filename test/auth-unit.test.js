import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/lib/crypto.js';
import { normalizePhone, validateFarmer } from '../src/lib/validation.js';

const farmer = {
  fullName: 'পরীক্ষার কৃষক',
  phone: '০১৭১২৩৪৫৬৭৮',
  password: 'একটিনিরাপদপাসওয়ার্ড',
  confirmPassword: 'একটিনিরাপদপাসওয়ার্ড',
  nid: '১২৩৪৫৬৭৮৯০',
  district: 'বগুড়া',
  upazila: 'শিবগঞ্জ',
  village: 'মহাস্থান',
  farmAddress: 'মহাস্থান, শিবগঞ্জ, বগুড়া',
};

test('Bangla digits and international phone formats normalize consistently', () => {
  for (const phone of ['০১৭১২৩৪৫৬৭৮', '+880 1712-345678', '8801712345678', '01712345678'])
    assert.equal(normalizePhone(phone), '01712345678');
  assert.equal(validateFarmer(farmer).nid, '1234567890');
  assert.equal(
    validateFarmer({ ...farmer, email: ' Example@Example.TEST ' }).email,
    'example@example.test',
  );
});

test('mandatory information, NID length and password confirmation are enforced', () => {
  for (const [key, value] of [
    ['fullName', ''],
    ['phone', '01212345678'],
    ['nid', '123'],
    ['password', 'short'],
    ['confirmPassword', 'different'],
    ['district', ''],
    ['upazila', ''],
    ['village', ''],
    ['farmAddress', ''],
    ['email', 'invalid'],
  ]) {
    assert.throws(
      () => validateFarmer({ ...farmer, [key]: value }),
      (error) => error.status === 422 && Boolean(error.fields[key]),
    );
  }
});

test('scrypt stores salted hashes and rejects wrong or malformed credentials', async () => {
  const first = await hashPassword(farmer.password);
  const second = await hashPassword(farmer.password);
  assert.notEqual(first, second);
  assert(!first.includes(farmer.password));
  assert.equal(await verifyPassword(farmer.password, first), true);
  assert.equal(await verifyPassword('incorrect', first), false);
  assert.equal(await verifyPassword(farmer.password, 'scrypt$bad'), false);
});
