import { Op } from 'sequelize';
import { models } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { hashPassword } from '../lib/crypto.js';
import { validPhone } from '../lib/validation.js';

export async function createAdminAccount(input = {}) {
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const phone = validPhone(input.phone);
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() || null : null;
  if (fullName.length < 2 || fullName.length > 100)
    throw new AppError(422, 'ADMIN_NAME-এ সঠিক নাম দিন।');
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    throw new AppError(422, 'ADMIN_EMAIL-এ সঠিক ইমেইল দিন, অথবা খালি রাখুন।');
  if (
    typeof input.password !== 'string' ||
    input.password.length < 6 ||
    input.password.length > 128
  )
    throw new AppError(422, 'ADMIN_PASSWORD-এ ৬ থেকে ১২৮ অক্ষরের পাসওয়ার্ড দিন।');
  const existing = await models.User.findOne({
    where: { [Op.or]: [{ phone }, ...(email ? [{ email }] : [])] },
  });
  if (existing) {
    if (
      existing.role === 'admin' &&
      existing.phone === phone &&
      (!email || existing.email === email)
    )
      return { created: false };
    throw new AppError(409, 'এই ফোন বা ইমেইল অন্য অ্যাকাউন্টে ব্যবহার হচ্ছে। আলাদা পরিচয় দিন।');
  }
  await models.User.create({
    fullName,
    phone,
    email,
    passwordHash: await hashPassword(input.password),
    role: 'admin',
    phoneVerifiedAt: null,
  });
  return { created: true };
}

export function applicationData(profile) {
  const user = profile.user;
  return {
    userId: profile.userId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    registeredAt: user.createdAt,
    businessName: profile.businessName,
    businessType: profile.businessType,
    address: profile.address,
    status: profile.status,
    rejectionReason: profile.rejectionReason,
    submittedAt: profile.submittedAt,
    reviewedAt: profile.reviewedAt,
    version: profile.applicationVersion,
    documents: (profile.documents || []).map((document) => ({
      id: document.id,
      documentType: document.documentType,
      url: `/api/admin/buyers/${profile.userId}/documents/${document.id}`,
    })),
  };
}

export async function listBuyerApplications(query = {}) {
  const status = query.status || 'pending';
  if (!['pending', 'approved', 'rejected', 'all'].includes(status))
    throw new AppError(422, 'আবেদনের সঠিক অবস্থা বেছে নিন।');
  const page = Number(query.page || 1),
    pageSize = 20;
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    throw new AppError(422, 'পাতার নম্বর সঠিক নয়।');
  const { rows, count } = await models.BuyerProfile.findAndCountAll({
    where: status === 'all' ? {} : { status },
    include: [
      { model: models.User, as: 'user', required: true, where: { role: 'buyer' } },
      {
        model: models.BuyerDocument,
        as: 'documents',
        attributes: ['id', 'documentType'],
        required: false,
      },
    ],
    order: [
      ['submittedAt', 'DESC'],
      ['userId', 'ASC'],
    ],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const counts = {};
  for (const key of ['pending', 'approved', 'rejected'])
    counts[key] = await models.BuyerProfile.count({ where: { status: key } });
  return {
    buyers: rows.map(applicationData),
    counts,
    pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
  };
}

export async function reviewBuyerApplication(adminId, userId, input = {}) {
  input ??= {};
  if (!['approved', 'rejected'].includes(input.decision))
    throw new AppError(422, 'অনুমোদন অথবা প্রত্যাখ্যান বেছে নিন।');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (input.decision === 'rejected' && (reason.length < 5 || reason.length > 500))
    throw new AppError(422, 'প্রত্যাখ্যানের কারণ ৫ থেকে ৫০০ অক্ষরে লিখুন।', {
      reason: 'প্রত্যাখ্যানের কারণ আবশ্যক।',
    });
  return sequelize.transaction(async (transaction) => {
    const profile = await models.BuyerProfile.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!profile) throw new AppError(404, 'ক্রেতার আবেদন পাওয়া যায়নি।');
    if (profile.status !== 'pending' || input.version !== profile.applicationVersion)
      throw new AppError(409, 'আবেদনের অবস্থা বদলেছে। তালিকা হালনাগাদ করে আবার দেখুন।');
    await profile.update(
      {
        status: input.decision,
        rejectionReason: input.decision === 'rejected' ? reason : null,
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
      { transaction },
    );
    profile.user = await models.User.findByPk(userId, { transaction });
    return applicationData(profile);
  });
}
