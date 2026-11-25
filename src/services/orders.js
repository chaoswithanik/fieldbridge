import { matchingCropWhere } from '../lib/crop-identity.js';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { env } from '../config/env.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { scaledDecimal, decimalString, requirementLotQuantities } from '../lib/collective-matching.js';
import {
  orderSelection,
  orderSubmission,
  orderDecision,
  privatePage,
  uuidPattern,
} from '../lib/order-validation.js';
import { findOwnRequirement } from './requirements.js';
import { summarizePortions } from '../lib/order-summary.js';
const quantity = (value) => scaledDecimal(value, 3);
const cost = (amount, price) => (quantity(amount) * scaledDecimal(price, 2) + 500n) / 1000n;
const stale = () =>
  new AppError(
    409,
    'চাহিদা, দাম বা মজুত বদলেছে। মিলে যাওয়া ফসল হালনাগাদ করে অর্ডারের তথ্য আবার খুলুন।',
  );
const signature = (body) =>
  createHmac('sha256', env.orders.quoteSecret).update(body).digest('base64url');
export function signQuote(selection) {
  const body = Buffer.from(JSON.stringify(selection)).toString('base64url');
  return `${body}.${signature(body)}`;
}
export function openQuote(token, buyerId) {
  const [body, signed, extra] = token.split('.');
  if (
    !body ||
    !signed ||
    extra ||
    !/^[A-Za-z0-9_-]{43}$/.test(signed) ||
    !timingSafeEqual(Buffer.from(signature(body)), Buffer.from(signed))
  )
    throw stale();
  try {
    const quote = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (quote.buyerId !== buyerId) throw stale();
    return quote;
  } catch {
    throw stale();
  }
}
export async function assertApprovedOrderBuyer(buyerId, transaction, lock = 'UPDATE') {
  const profile = await models.BuyerProfile.findByPk(buyerId, {
    ...(transaction ? { transaction, lock: transaction.LOCK[lock] } : {}),
  });
  if (!profile || profile.status !== 'approved')
    throw new AppError(403, 'অর্ডার পরিচালনার জন্য ক্রেতার অনুমোদন নেই।');
  return profile;
}
async function selectionPreview(buyerId, input, transaction) {
  const selected = orderSelection(input),
    requirement = await findOwnRequirement(buyerId, selected.requirementId, transaction);
  if (requirement.status !== 'active')
    throw new AppError(409, 'অর্ডার দেওয়ার আগে ক্রয় চাহিদাটি চালু করুন।');
  const rows = [],
    farmers = new Map();
  // All inventory writers acquire listing locks in the same UUID order.
  for (const id of selected.listingIds) {
    const row = await models.CropListing.findOne({
      where: { id, ...matchingCropWhere(requirement) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (
      !row ||
      row.status !== 'active' ||
      quantity(row.quantity) <= 0n ||
      row.unit !== requirement.unit
    )
      throw stale();
    if (!farmers.has(row.farmerId)) {
      const farmer = await models.User.findOne({
        where: { id: row.farmerId, role: 'farmer', phoneVerifiedAt: { [Op.ne]: null } },
        attributes: ['id', 'fullName', 'phone'],
        include: [
          {
            model: models.FarmerProfile,
            as: 'farmerProfile',
            required: true,
            attributes: ['farmName'],
          },
        ],
        transaction,
      });
      if (!farmer) throw stale();
      farmers.set(row.farmerId, farmer);
    }
    rows.push(row);
  }
  const mode = farmers.size === 1 ? 'individual' : 'collective';
  const target = quantity(requirement.quantity);
  const amounts = requirementLotQuantities(rows, requirement.quantity);
  const total = [...amounts.values()].reduce((sum, amount) => sum + amount, 0n);
  if (total * 5n > target * 6n || [...amounts.values()].includes(0n)) throw stale();
  const items = rows.map((row) => {
    const farmer = farmers.get(row.farmerId);
    const amount = decimalString(amounts.get(row.id), 3);
    return {
      listingId: row.id,
      listingVersion: row.version,
      farmerId: row.farmerId,
      quantity: amount,
      subtotal: decimalString(cost(amount, row.pricePerUnit), 2),
      snapshot: orderItemSnapshot(row, farmer),
    };
  });
  const buyer = await models.User.findByPk(buyerId, {
    attributes: ['fullName', 'phone'],
    transaction,
  });
  const profile = await models.BuyerProfile.findByPk(buyerId, { transaction });
  const snapshot = {
    cropId: requirement.cropId,
    varietyId: requirement.varietyId,
    cropName: requirement.cropName,
    unit: requirement.unit,
    requestedQuantity: requirement.quantity,
    deliveryAddress: requirement.deliveryAddress,
    instructions: requirement.instructions,
    buyerName: buyer.fullName,
    buyerPhone: buyer.phone,
    businessName: profile.businessName,
  };
  const payload = {
    buyerId,
    requirementId: requirement.id,
    requirementVersion: requirement.version,
    mode,
    items: items.map((item) => ({
      id: item.listingId,
      version: item.listingVersion,
      quantity: item.quantity,
    })),
  };
  return {
    rows,
    items,
    snapshot,
    mode,
    totalQuantity: decimalString(total, 3),
    totalCost: decimalString(
      items.reduce((sum, item) => sum + scaledDecimal(item.subtotal, 2), 0n),
      2,
    ),
    token: signQuote(payload),
  };
}
export function publicPreview(preview) {
  return {
    mode: preview.mode,
    ...preview.snapshot,
    totalQuantity: preview.totalQuantity,
    totalCost: preview.totalCost,
    items: preview.items.map(({ farmerId, listingVersion, ...item }) => item),
  };
}
export function orderItemSnapshot(row, farmer) {
  return {
    cropId: row.cropId,
    varietyId: row.varietyId,
    cropName: row.cropName,
    unit: row.unit,
    pricePerUnit: row.pricePerUnit,
    harvestDate: row.harvestDate,
    availableDate: row.availableDate,
    district: row.district,
    upazila: row.upazila,
    farmAddress: row.farmAddress,
    farmerName: farmer.fullName,
    farmerPhone: farmer.phone,
    farmName: farmer.farmerProfile.farmName,
  };
}
export async function addOrderPortions(order, items, transaction, replacementId = null) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.farmerId)) groups.set(item.farmerId, []);
    groups.get(item.farmerId).push(item);
  }
  for (const [farmerId, members] of groups) {
    const first = members[0].snapshot;
    const portion = await models.OrderPortion.create(
      {
        orderId: order.id,
        farmerId,
        replacementId,
        snapshot: {
          fullName: first.farmerName,
          phone: first.farmerPhone,
          farmName: first.farmName,
        },
        quantity: decimalString(
          members.reduce((sum, item) => sum + quantity(item.quantity), 0n),
          3,
        ),
        totalCost: decimalString(
          members.reduce((sum, item) => sum + scaledDecimal(item.subtotal, 2), 0n),
          2,
        ),
      },
      { transaction },
    );
    await models.OrderItem.bulkCreate(
      members.map((item) => ({
        portionId: portion.id,
        listingId: item.listingId,
        quantity: item.quantity,
        subtotal: item.subtotal,
        snapshot: item.snapshot,
      })),
      { transaction },
    );
    await models.Notification.create(
      {
        recipientId: farmerId,
        orderId: order.id,
        title: replacementId ? 'বিকল্প সরবরাহের নতুন অর্ডার' : 'নতুন ফসলের অর্ডার',
        message: `${order.snapshot.cropName} সরবরাহের একটি অর্ডার এসেছে। নিজের অংশ দেখে গ্রহণ বা প্রত্যাখ্যান করুন। উত্তর দেওয়ার সময়সীমা নেই।`,
      },
      { transaction },
    );
  }
}
export async function reserveOrderItems(rows, items, transaction) {
  const amounts = new Map(items.map((item) => [item.listingId, quantity(item.quantity)]));
  for (const row of rows) {
    const held = amounts.get(row.id);
    await row.update(
      {
        quantity: decimalString(quantity(row.quantity) - held, 3),
        reservedQuantity: decimalString(quantity(row.reservedQuantity) + held, 3),
        version: row.version + 1,
      },
      { transaction },
    );
  }
}
export async function previewOrder(buyerId, input, parentTransaction) {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED, transaction: parentTransaction },
    async (transaction) => {
      await assertApprovedOrderBuyer(buyerId, transaction);
      const preview = await selectionPreview(buyerId, input, transaction);
      return { preview: publicPreview(preview), quoteToken: preview.token };
    },
  );
}
export async function fetchOrder(user, id, transaction) {
  if (!uuidPattern.test(id || '')) throw new AppError(404, 'অর্ডারটি খুঁজে পাওয়া যায়নি।');
  const order = await models.Order.findOne({
    where: { id, ...(user.role === 'buyer' ? { buyerId: user.id } : {}) },
    attributes: [
      'id',
      'requirementId',
      'mode',
      'snapshot',
      'totalQuantity',
      'totalCost',
      'createdAt',
      'updatedAt',
      'version',
    ],
    include: [
      {
        model: models.OrderPortion,
        as: 'portions',
        required: true,
        ...(user.role === 'farmer' ? { where: { farmerId: user.id } } : {}),
        attributes: [
          'id',
          'status',
          'quantity',
          'totalCost',
          'snapshot',
          'version',
          'respondedAt',
          'replacementId',
          'createdAt',
        ],
        include: [
          {
            model: models.OrderItem,
            as: 'items',
            attributes: ['id', 'listingId', 'quantity', 'subtotal', 'snapshot'],
          },
        ],
      },
    ],
    order: [
      [{ model: models.OrderPortion, as: 'portions' }, 'id', 'ASC'],
      [
        { model: models.OrderPortion, as: 'portions' },
        { model: models.OrderItem, as: 'items' },
        'id',
        'ASC',
      ],
    ],
    transaction,
  });
  if (!order) throw new AppError(404, 'অর্ডারটি খুঁজে পাওয়া যায়নি।');
  const portions = order.portions.map((portion) => ({
    id: portion.id,
    isReplacement: Boolean(portion.replacementId),
    status: portion.status,
    quantity: portion.quantity,
    totalCost: portion.totalCost,
    farmer: portion.snapshot,
    version: portion.version,
    respondedAt: portion.respondedAt,
    items: portion.items.map((item) => ({
      id: item.id,
      listingId: item.listingId,
      quantity: item.quantity,
      subtotal: item.subtotal,
      ...item.snapshot,
    })),
  }));
  const own = user.role === 'farmer',
    amount = own
      ? decimalString(
          portions.reduce((sum, p) => sum + quantity(p.quantity), 0n),
          3,
        )
      : order.totalQuantity;
  const { requestedQuantity, ...farmerSnapshot } = order.snapshot;
  return {
    id: order.id,
    ...(own ? {} : { requirementId: order.requirementId, version: order.version }),
    mode: order.mode,
    ...(own ? farmerSnapshot : order.snapshot),
    totalQuantity: amount,
    totalCost: own
      ? decimalString(
          portions.reduce((sum, p) => sum + scaledDecimal(p.totalCost, 2), 0n),
          2,
        )
      : order.totalCost,
    ...summarizePortions(
      portions,
      own ? amount : requestedQuantity,
      own ? amount : order.totalQuantity,
    ),
    portions,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
export async function readOrder(user, id) {
  if (!['buyer', 'farmer'].includes(user.role))
    throw new AppError(403, 'এই অর্ডার দেখার অনুমতি নেই।');
  if (user.role === 'buyer') await assertApprovedOrderBuyer(user.id);
  return fetchOrder(user, id);
}
export async function listOrders(user, query) {
  if (!['buyer', 'farmer'].includes(user.role))
    throw new AppError(403, 'অর্ডারের তালিকা দেখার অনুমতি নেই।');
  if (user.role === 'buyer') await assertApprovedOrderBuyer(user.id);
  const page = privatePage(query),
    own = user.role === 'buyer';
  const model = own ? models.Order : models.OrderPortion;
  const { rows, count } = await model.findAndCountAll({
    where: own ? { buyerId: user.id } : { farmerId: user.id },
    attributes: own ? ['id'] : ['orderId'],
    limit: 12,
    offset: (page - 1) * 12,
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });
  return {
    orders: await Promise.all(rows.map((row) => fetchOrder(user, own ? row.id : row.orderId))),
    total: count,
    page,
    pages: Math.max(1, Math.ceil(count / 12)),
  };
}
export async function placeOrder(buyerId, input, parentTransaction) {
  const { quoteToken, requestId } = orderSubmission(input),
    requestHash = createHash('sha256').update(quoteToken).digest('hex');
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED, transaction: parentTransaction },
    async (transaction) => {
      await assertApprovedOrderBuyer(buyerId, transaction);
      const existing = await models.Order.findOne({ where: { buyerId, requestId }, transaction });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new AppError(
            409,
            'এই অনুরোধে ইতিমধ্যে অন্য অর্ডার তৈরি হয়েছে। অর্ডারের তালিকা দেখুন।',
          );
        return {
          order: await fetchOrder({ id: buyerId, role: 'buyer' }, existing.id, transaction),
          created: false,
        };
      }
      const quote = openQuote(quoteToken, buyerId);
      if (quote.purpose) throw stale();
      const preview = await selectionPreview(
        buyerId,
        { requirementId: quote.requirementId, listingIds: quote.items.map((item) => item.id) },
        transaction,
      );
      if (preview.token !== quoteToken) throw stale();
      const order = await models.Order.create(
        {
          buyerId,
          requirementId: quote.requirementId,
          requestId,
          requestHash,
          mode: preview.mode,
          snapshot: preview.snapshot,
          totalQuantity: preview.totalQuantity,
          totalCost: preview.totalCost,
        },
        { transaction },
      );
      await addOrderPortions(order, preview.items, transaction);
      await reserveOrderItems(preview.rows, preview.items, transaction);
      await models.Notification.create(
        {
          recipientId: buyerId,
          orderId: order.id,
          title: 'আপনার অর্ডার তৈরি হয়েছে',
          message: `${preview.snapshot.cropName}-এর অর্ডারের মজুত সংরক্ষিত হয়েছে। কৃষকদের উত্তরের অগ্রগতি অর্ডারে দেখুন।`,
        },
        { transaction },
      );
      return {
        order: await fetchOrder({ id: buyerId, role: 'buyer' }, order.id, transaction),
        created: true,
      };
    },
  );
}
export async function respondToOrder(farmerId, portionId, input, parentTransaction) {
  const { decision, version } = orderDecision(input);
  if (!uuidPattern.test(portionId || ''))
    throw new AppError(404, 'অর্ডারের অংশটি খুঁজে পাওয়া যায়নি।');
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED, transaction: parentTransaction },
    async (transaction) => {
      const owned = await models.OrderPortion.findOne({
        where: { id: portionId, farmerId },
        attributes: ['orderId'],
        transaction,
      });
      if (!owned) throw new AppError(404, 'অর্ডারের অংশটি খুঁজে পাওয়া যায়নি।');
      const order = await models.Order.findByPk(owned.orderId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const portion = await models.OrderPortion.findOne({
        where: { id: portionId, farmerId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (portion.status === decision)
        return fetchOrder({ id: farmerId, role: 'farmer' }, order.id, transaction);
      if (portion.status !== 'pending' || portion.version !== version)
        throw new AppError(
          409,
          'এই অংশের উত্তর ইতিমধ্যে দেওয়া হয়েছে বা তথ্য বদলেছে। সর্বশেষ অর্ডার দেখুন।',
        );
      if (decision === 'rejected') {
        const items = await models.OrderItem.findAll({
          where: { portionId },
          order: [['listingId', 'ASC']],
          transaction,
        });
        for (const item of items) {
          const row =
            item.listingId &&
            (await models.CropListing.findByPk(item.listingId, {
              transaction,
              lock: transaction.LOCK.UPDATE,
            }));
          if (!row || quantity(row.reservedQuantity) < quantity(item.quantity))
            throw new AppError(409, 'সংরক্ষিত মজুতের তথ্য মিলছে না। পরে আবার চেষ্টা করুন।');
          await row.update(
            {
              quantity: decimalString(quantity(row.quantity) + quantity(item.quantity), 3),
              reservedQuantity: decimalString(
                quantity(row.reservedQuantity) - quantity(item.quantity),
                3,
              ),
              version: row.version + 1,
            },
            { transaction },
          );
        }
      }
      await portion.update(
        { status: decision, respondedAt: new Date(), version: portion.version + 1 },
        { transaction },
      );
      await order.update({ version: order.version + 1, updatedAt: new Date() }, { transaction });
      const portions = await models.OrderPortion.findAll({
        where: { orderId: order.id },
        transaction,
      });
      const summary = summarizePortions(
        portions,
        order.snapshot.requestedQuantity,
        order.totalQuantity,
      );
      const unit = { kg: 'কেজি', ton: 'মেট্রিক টন', piece: 'পিস' }[order.snapshot.unit];
      const amount = (value) =>
        new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 3 }).format(Number(value));
      await models.Notification.create(
        {
          recipientId: order.buyerId,
          orderId: order.id,
          title:
            decision === 'accepted'
              ? 'কৃষক অর্ডারের অংশ গ্রহণ করেছেন'
              : 'কৃষক অর্ডারের অংশ প্রত্যাখ্যান করেছেন',
          message: `${order.snapshot.cropName}: গৃহীত ${amount(summary.acceptedQuantity)} ${unit}, উত্তরের অপেক্ষায় ${amount(summary.pendingQuantity)} ${unit}, এখনো প্রয়োজন ${amount(summary.unfulfilledQuantity)} ${unit}।${decision === 'rejected' ? ' অর্ডার খুলে বিকল্প সরবরাহের পরামর্শ দেখুন ও নিজে বেছে নিন।' : ''}`,
        },
        { transaction },
      );
      return fetchOrder({ id: farmerId, role: 'farmer' }, order.id, transaction);
    },
  );
}
