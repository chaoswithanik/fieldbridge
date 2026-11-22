import { sequelize } from '../config/database.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { hashPassword } from '../lib/crypto.js';
import { validPhone } from '../lib/validation.js';
import { newSession, publicUser } from './auth.js';

export function validateBuyer(input = {}, registration = true) {
  input ??= {};
  const fields = {},
    values = {};
  for (const [key, label, min, max] of [
    ['fullName', 'পুরো নাম', 2, 100],
    ['businessName', 'ব্যবসা বা প্রতিষ্ঠানের নাম', 2, 160],
    ['businessType', 'ব্যবসার ধরন', 2, 80],
    ['address', 'পূর্ণ ঠিকানা', 5, 500],
  ]) {
    values[key] = typeof input[key] === 'string' ? input[key].trim() : '';
    if (values[key].length < min || values[key].length > max)
      fields[key] = `${label} সঠিকভাবে লিখুন।`;
  }
  values.email = typeof input.email === 'string' ? input.email.trim().toLowerCase() || null : null;
  if (
    values.email &&
    (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
  )
    fields.email = 'একটি সঠিক ইমেইল ঠিকানা দিন।';
  if (registration) {
    try {
      values.phone = validPhone(input.phone);
    } catch {
      fields.phone = 'বাংলাদেশের ১১ সংখ্যার মোবাইল নম্বর দিন।';
    }
    values.password = typeof input.password === 'string' ? input.password : '';
    if (values.password.length < 8 || values.password.length > 128)
      fields.password = 'পাসওয়ার্ড ৮ থেকে ১২৮ অক্ষরের হতে হবে।';
    if (input.confirmPassword !== values.password)
      fields.confirmPassword = 'দুটি পাসওয়ার্ড মিলছে না।';
  }
  if (Object.keys(fields).length)
    throw new AppError(422, 'চিহ্নিত তথ্যগুলো ঠিক করে আবার চেষ্টা করুন।', fields);
  return values;
}

function validateIdentity(input) {
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() || null : null;
  const fields = {};
  if (fullName.length < 2 || fullName.length > 100)
    fields.fullName = 'পুরো নাম ২ থেকে ১০০ অক্ষরে লিখুন।';
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    fields.email = 'একটি সঠিক ইমেইল ঠিকানা দিন।';
  if (Object.keys(fields).length) throw new AppError(422, 'চিহ্নিত তথ্যগুলো ঠিক করুন।', fields);
  return { fullName, email };
}

export async function createBuyer(input) {
  const values = validateBuyer(input);
  const passwordHash = await hashPassword(values.password);
  return sequelize.transaction(async (transaction) => {
    const user = await models.User.create(
      {
        role: 'buyer',
        fullName: values.fullName,
        phone: values.phone,
        email: values.email,
        passwordHash,
        phoneVerifiedAt: null,
      },
      { transaction },
    );
    user.buyerProfile = await models.BuyerProfile.create(
      {
        userId: user.id,
        businessName: values.businessName,
        businessType: values.businessType,
        address: values.address,
        status: 'pending',
        submittedAt: new Date(),
        applicationVersion: 1,
      },
      { transaction },
    );
    return { user: publicUser(user), ...(await newSession(user.id, transaction)) };
  });
}

export async function resubmitBuyer(userId, input = {}) {
  input ??= {};
  const allowed = ['fullName', 'email', 'businessName', 'businessType', 'address', 'version'];
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new AppError(422, 'শুধু আবেদনের সংশোধনযোগ্য তথ্য পাঠান।');
  const values = validateBuyer(input, false);
  return sequelize.transaction(async (transaction) => {
    const profile = await models.BuyerProfile.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!profile || profile.status !== 'rejected')
      throw new AppError(409, 'শুধু প্রত্যাখ্যাত আবেদন পুনরায় জমা দেওয়া যাবে।');
    if (input.version !== profile.applicationVersion)
      throw new AppError(409, 'আবেদনের অবস্থা বদলেছে। পাতা হালনাগাদ করে আবার চেষ্টা করুন।');
    const user = await models.User.findByPk(userId, { transaction });
    await user.update({ fullName: values.fullName, email: values.email }, { transaction });
    await profile.update(
      {
        businessName: values.businessName,
        businessType: values.businessType,
        address: values.address,
        status: 'pending',
        rejectionReason: null,
        reviewedAt: null,
        reviewedBy: null,
        submittedAt: new Date(),
        applicationVersion: profile.applicationVersion + 1,
      },
      { transaction },
    );
    user.buyerProfile = profile;
    return user;
  });
}

export async function editBuyerIdentity(userId, input = {}) {
  input ??= {};
  if (Object.keys(input).some((key) => !['fullName', 'email'].includes(key)))
    throw new AppError(422, 'এখানে শুধু নাম ও ইমেইল পরিবর্তন করা যাবে।');
  const values = validateIdentity(input);
  return sequelize.transaction(async (transaction) => {
    const profile = await models.BuyerProfile.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!profile) throw new AppError(404, 'ক্রেতার অ্যাকাউন্ট পাওয়া যায়নি।');
    const user = await models.User.findByPk(userId, { transaction });
    await user.update(values, { transaction });
    await profile.update({ applicationVersion: profile.applicationVersion + 1 }, { transaction });
    user.buyerProfile = profile;
    return user;
  });
}
