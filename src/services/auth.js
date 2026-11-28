import { randomBytes, randomInt } from 'node:crypto';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { env } from '../config/env.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { hashPassword, verifyPassword, tokenDigest, otpDigest, sameDigest } from '../lib/crypto.js';
import { validPhone, normalizeDigits, normalizePhone, validateFarmer } from '../lib/validation.js';
import { prepareAvatar, saveAvatar, deleteAvatar } from './avatar.js';

export const SESSION_COOKIE = 'fieldbridge_session';
export const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax',
  path: '/api',
};

export function publicUser(user) {
  const profile = user.farmerProfile;
  const buyer = user.buyerProfile;
  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    buyerProfile: buyer
      ? {
          businessName: buyer.businessName,
          businessType: buyer.businessType,
          address: buyer.address,
          status: buyer.status,
          rejectionReason: buyer.rejectionReason,
          submittedAt: buyer.submittedAt,
          reviewedAt: buyer.reviewedAt,
          version: buyer.applicationVersion,
        }
      : null,
    farmerProfile: profile
      ? {
          district: profile.district,
          upazila: profile.upazila,
          village: profile.village,
          farmAddress: profile.farmAddress,
          farmName: profile.farmName,
          version: tokenDigest(JSON.stringify([
            user.fullName, user.email, profile.district, profile.upazila, profile.village,
            profile.farmAddress, profile.farmName, profile.avatarFilename,
          ])),
          nidLast4: profile.nid.slice(-4),
          photoUrl: profile.avatarFilename ? `/api/media/avatars/${profile.avatarFilename}` : null,
        }
      : null,
  };
}

export async function requestFarmerOtp(input = {}) {
  input ??= {};
  const phone = validPhone(input.phone);
  if (env.auth.otpMode !== 'console' || env.nodeEnv === 'production') {
    throw new AppError(503, 'ফোন যাচাইকরণ সেবা এখন চালু নেই। পরে আবার চেষ্টা করুন।');
  }
  if (await models.User.findOne({ where: { phone } })) {
    throw new AppError(409, 'এই ফোন নম্বরে ইতিমধ্যে অ্যাকাউন্ট আছে। প্রবেশ করুন।', {
      phone: 'এই নম্বরটি দিয়ে প্রবেশ করুন।',
    });
  }
  const code = String(randomInt(100000, 1000000));
  const now = new Date();
  const outcome = await sequelize.transaction(async (transaction) => {
    const [record] = await models.PhoneVerification.findOrCreate({
      where: { phone },
      defaults: { codeHash: '', expiresAt: now, nextSendAt: now },
      transaction,
    });
    await record.reload({ transaction, lock: transaction.LOCK.UPDATE });
    if (record.nextSendAt > now)
      return { error: new AppError(429, 'আবার কোড নেওয়ার আগে এক মিনিট অপেক্ষা করুন।') };
    await record.update(
      {
        codeHash: otpDigest(record.id, code),
        attempts: 0,
        consumedAt: null,
        expiresAt: new Date(now.getTime() + env.auth.otpExpiresSeconds * 1000),
        nextSendAt: new Date(now.getTime() + env.auth.otpResendSeconds * 1000),
      },
      { transaction },
    );
    return { challengeId: record.id, expiresAt: record.expiresAt, resendAt: record.nextSendAt };
  });
  if (outcome.error) throw outcome.error;
  // Explicit development transport. Never return the code in an HTTP response.
  console.info(`[ফিল্ডব্রিজ OTP] ফোন: ${phone} | কোড: ${code} | মেয়াদ: ৫ মিনিট (শুধু development)`);
  return outcome;
}

export async function newSession(userId, transaction) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + env.auth.sessionDays * 86400000);
  await models.AuthSession.create(
    { userId, tokenHash: tokenDigest(token), expiresAt },
    { transaction },
  );
  return { token, expiresAt };
}

export async function registerFarmer(input, file) {
  const values = validateFarmer(input);
  const code = normalizeDigits(input.code).trim();
  if (
    typeof input.challengeId !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(input.challengeId) ||
    !/^\d{6}$/.test(code)
  ) {
    throw new AppError(422, 'সঠিক যাচাইকরণ কোড দিন।', { code: '৬ সংখ্যার কোডটি লিখুন।' });
  }
  const avatarBuffer = await prepareAvatar(file);
  let avatarFilename;
  try {
    const outcome = await sequelize.transaction(async (transaction) => {
      const verification = await models.PhoneVerification.findByPk(input.challengeId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!verification || verification.phone !== values.phone || verification.consumedAt)
        return { error: new AppError(400, 'এই যাচাইকরণটি আর ব্যবহার করা যাবে না। নতুন কোড নিন।') };
      if (verification.expiresAt <= new Date())
        return {
          error: new AppError(410, 'কোডের মেয়াদ শেষ হয়েছে। নতুন কোড নিন।', {
            code: 'কোডের মেয়াদ শেষ হয়েছে।',
          }),
        };
      if (verification.attempts >= env.auth.otpMaxAttempts)
        return {
          error: new AppError(429, 'অনেকবার ভুল কোড দেওয়া হয়েছে। নতুন কোড নিন।', {
            code: 'নতুন কোড নিয়ে আবার চেষ্টা করুন।',
          }),
        };
      if (!sameDigest(verification.codeHash, otpDigest(verification.id, code))) {
        await verification.increment('attempts', { transaction });
        return {
          error: new AppError(422, 'যাচাইকরণ কোডটি মিলছে না।', { code: 'সঠিক কোডটি আবার লিখুন।' }),
        };
      }
      const passwordHash = await hashPassword(values.password);
      const user = await models.User.create(
        {
          fullName: values.fullName,
          phone: values.phone,
          email: values.email,
          passwordHash,
          role: 'farmer',
          phoneVerifiedAt: new Date(),
        },
        { transaction },
      );
      avatarFilename = await saveAvatar(avatarBuffer);
      const profile = await models.FarmerProfile.create(
        {
          userId: user.id,
          nid: values.nid,
          district: values.district,
          upazila: values.upazila,
          village: values.village,
          farmAddress: values.farmAddress,
          farmName: values.farmName,
          avatarFilename,
        },
        { transaction },
      );
      await verification.update({ consumedAt: new Date() }, { transaction });
      user.farmerProfile = profile;
      return { user: publicUser(user), ...(await newSession(user.id, transaction)) };
    });
    if (outcome.error) throw outcome.error;
    return outcome;
  } catch (error) {
    await deleteAvatar(avatarFilename);
    throw error;
  }
}

// A missing account still performs a real password derivation.
let dummyHash;
export async function login(input = {}) {
  input ??= {};
  if (
    typeof input.identifier !== 'string' ||
    typeof input.password !== 'string' ||
    !input.identifier.trim() ||
    !input.password ||
    input.password.length > 128 ||
    input.identifier.length > 254
  ) {
    throw new AppError(422, 'ফোন নম্বর বা ইমেইল এবং পাসওয়ার্ড লিখুন।');
  }
  const identifier = input.identifier.trim();
  const where = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { phone: normalizePhone(identifier) };
  const user = await models.User.unscoped().findOne({
    where,
    include: [
      { model: models.FarmerProfile, as: 'farmerProfile' },
      { model: models.BuyerProfile, as: 'buyerProfile' },
    ],
  });
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
  const valid = await verifyPassword(input.password, user?.passwordHash || (await dummyHash));
  const eligible =
    user && !user.blocked &&
    (user.role === 'admin' ||
      (user.role === 'buyer' && user.buyerProfile) ||
      (user.role === 'farmer' && user.phoneVerifiedAt && user.farmerProfile));
  if (!valid || !eligible) {
    throw new AppError(401, 'ফোন নম্বর বা ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।');
  }
  const session = await sequelize.transaction(async (transaction) => {
    const account = await models.User.findByPk(user.id, { attributes: ['blocked'], transaction, lock: transaction.LOCK.UPDATE });
    if (!account || account.blocked) throw new AppError(403, 'এই অ্যাকাউন্টে প্রবেশ বন্ধ আছে।');
    await models.AuthSession.destroy({
      where: { userId: user.id, expiresAt: { [Op.lt]: new Date() } },
      transaction,
    });
    return newSession(user.id, transaction);
  });
  return { user: publicUser(user), ...session };
}

export async function currentUser(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await models.AuthSession.findOne({
    where: { tokenHash: tokenDigest(token), expiresAt: { [Op.gt]: new Date() } },
    include: [
      {
        model: models.User,
        as: 'user',
        include: [
          { model: models.FarmerProfile, as: 'farmerProfile' },
          { model: models.BuyerProfile, as: 'buyerProfile' },
        ],
      },
    ],
  });
  const user = session?.user;
  if (!user || user.blocked) return null;
  if (user.role === 'farmer' && (!user.phoneVerifiedAt || !user.farmerProfile)) return null;
  if (user.role === 'buyer' && !user.buyerProfile) return null;
  return publicUser(user);
}

export async function revokeSession(token) {
  if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token))
    await models.AuthSession.destroy({ where: { tokenHash: tokenDigest(token) } });
}
