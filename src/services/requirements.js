import { sequelize } from '../config/database.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import {
  requirementStatuses,
  requirementFields,
  onlyRequirementFields,
  validateRequirement,
  requirementVersion,
} from '../lib/requirement-validation.js';

export function ownRequirement(row) {
  return {
    id: row.id,
    cropName: row.cropName,
    quantity: row.quantity,
    unit: row.unit,
    deliveryAddress: row.deliveryAddress,
    instructions: row.instructions,
    status: row.status,
    editCount: row.editCount,
    editsRemaining: Math.max(0, 2 - row.editCount),
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function approvedBuyer(buyerId, transaction) {
  // Serialize approval changes with writes, rather than trusting an earlier request check.
  const profile = await models.BuyerProfile.findByPk(buyerId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!profile || profile.status !== 'approved')
    throw new AppError(403, 'চাহিদা পরিচালনার জন্য ক্রেতার অনুমোদন নেই।');
}

export async function findOwnRequirement(buyerId, id, transaction) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
    throw new AppError(404, 'চাহিদাটি খুঁজে পাওয়া যায়নি।');
  const row = await models.PurchaseRequirement.findOne({
    where: { id, buyerId },
    ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!row) throw new AppError(404, 'চাহিদাটি খুঁজে পাওয়া যায়নি।');
  return row;
}

function currentVersion(row, version) {
  if (row.version !== version)
    throw new AppError(409, 'চাহিদাটি অন্য সময়ে বদলেছে। সর্বশেষ তথ্য এনে আবার চেষ্টা করুন।');
}

export async function listOwnRequirements(buyerId, query = {}) {
  const status = query.status || 'all',
    page = Number(query.page || 1);
  if (
    Object.keys(query).some((key) => !['status', 'page'].includes(key)) ||
    (status !== 'all' && !requirementStatuses.includes(status)) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000
  )
    throw new AppError(422, 'পাতা বা চাহিদার অবস্থা সঠিক নয়।');
  const { rows, count } = await models.PurchaseRequirement.findAndCountAll({
    where: { buyerId, ...(status === 'all' ? {} : { status }) },
    limit: 12,
    offset: (page - 1) * 12,
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });
  const counts = Object.fromEntries(
    await Promise.all(
      requirementStatuses.map(async (value) => [
        value,
        await models.PurchaseRequirement.count({ where: { buyerId, status: value } }),
      ]),
    ),
  );
  return {
    requirements: rows.map(ownRequirement),
    counts,
    total: count,
    page,
    pages: Math.max(1, Math.ceil(count / 12)),
  };
}

export async function createRequirement(buyerId, input) {
  onlyRequirementFields(input, requirementFields);
  const values = validateRequirement(input);
  return sequelize.transaction(async (transaction) => {
    await approvedBuyer(buyerId, transaction);
    return ownRequirement(
      await models.PurchaseRequirement.create({ ...values, buyerId }, { transaction }),
    );
  });
}

export async function editRequirement(buyerId, id, input) {
  onlyRequirementFields(input, [...requirementFields, 'version']);
  const values = validateRequirement(input),
    version = requirementVersion(input.version);
  return sequelize.transaction(async (transaction) => {
    await approvedBuyer(buyerId, transaction);
    const row = await findOwnRequirement(buyerId, id, transaction);
    currentVersion(row, version);
    if (row.editCount >= 2)
      throw new AppError(
        409,
        'এই চাহিদা ইতিমধ্যে ২ বার সম্পাদনা করা হয়েছে। আর সম্পাদনা করা যাবে না।',
      );
    const changed = requirementFields.some((key) =>
      key === 'quantity'
        ? Number(row.quantity) !== Number(values.quantity)
        : row[key] !== values[key],
    );
    if (changed)
      await row.update(
        { ...values, editCount: row.editCount + 1, version: row.version + 1 },
        { transaction },
      );
    return { requirement: ownRequirement(row), changed };
  });
}

export async function changeRequirementStatus(buyerId, id, input) {
  onlyRequirementFields(input, ['status', 'version']);
  if (!requirementStatuses.includes(input.status))
    throw new AppError(422, 'চাহিদার অবস্থা সঠিক নয়।');
  const version = requirementVersion(input.version);
  return sequelize.transaction(async (transaction) => {
    await approvedBuyer(buyerId, transaction);
    const row = await findOwnRequirement(buyerId, id, transaction);
    currentVersion(row, version);
    if (row.status !== input.status)
      await row.update({ status: input.status, version: row.version + 1 }, { transaction });
    return ownRequirement(row);
  });
}

export async function deleteRequirement(buyerId, id, input) {
  onlyRequirementFields(input, ['version']);
  const version = requirementVersion(input.version);
  await sequelize.transaction(async (transaction) => {
    await approvedBuyer(buyerId, transaction);
    const row = await findOwnRequirement(buyerId, id, transaction);
    currentVersion(row, version);
    await row.destroy({ transaction });
  });
}
