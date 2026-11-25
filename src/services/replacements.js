import { matchingCropWhere } from '../lib/crop-identity.js';
import { createHash } from 'node:crypto';
import { Op, Transaction, fn, col, where as sqlWhere } from 'sequelize';
import { sequelize } from '../config/database.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import {
  bestCollectiveCombinations,
  combinationComparator,
  administrativeProximity,
  scaledDecimal,
  decimalString,
} from '../lib/collective-matching.js';
import { summarizePortions } from '../lib/order-summary.js';
import { collectiveMatchQuery } from '../lib/matching-validation.js';
import {
  replacementSelection,
  replacementListingQuery,
  replacementListingSorts,
} from '../lib/replacement-validation.js';
import { orderSubmission, uuidPattern } from '../lib/order-validation.js';
import {
  assertApprovedOrderBuyer,
  signQuote,
  openQuote,
  fetchOrder,
  publicPreview,
  orderItemSnapshot,
  addOrderPortions,
  reserveOrderItems,
} from './orders.js';
import { marketFarmerJoin, marketListing } from './marketplace.js';
const amount = (value) => scaledDecimal(value, 3);
const lineCost = (quantity, price) => (amount(quantity) * scaledDecimal(price, 2) + 500n) / 1000n;
const transactionRead = { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
  transactionWrite = { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED };
const changed = () =>
  new AppError(
    409,
    'অর্ডারের বাকি পরিমাণ, দাম বা মজুত বদলেছে। সর্বশেষ তথ্য এনে বিকল্প সরবরাহ আবার বেছে নিন।',
  );
const candidateAttributes = [
  'id',
  'farmerId',
  'cropId',
  'varietyId',
  'cropName',
  'quantity',
  'unit',
  'pricePerUnit',
  'harvestDate',
  'availableDate',
  'district',
  'upazila',
  'farmAddress',
  'description',
  'photoFilenames',
  'createdAt',
];
async function context(buyerId, id, transaction, write = false) {
  if (!uuidPattern.test(id || '')) throw new AppError(404, 'অর্ডারটি খুঁজে পাওয়া যায়নি।');
  await assertApprovedOrderBuyer(buyerId, transaction, write ? 'UPDATE' : 'SHARE');
  const order = await models.Order.findOne({
    where: { id, buyerId },
    transaction,
    ...(write ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!order) throw new AppError(404, 'অর্ডারটি খুঁজে পাওয়া যায়নি।');
  const portions = await models.OrderPortion.findAll({ where: { orderId: id }, transaction });
  const summary = summarizePortions(
    portions,
    order.snapshot.requestedQuantity,
    order.totalQuantity,
  );
  return {
    order,
    summary,
    usedFarmers: [...new Set(portions.map((portion) => portion.farmerId))],
    remaining: amount(summary.replacementNeededQuantity),
  };
}
function candidateWhere(ctx) {
  return {
    ...matchingCropWhere(ctx.order.snapshot),
    unit: ctx.order.snapshot.unit,
    status: 'active',
    quantity: { [Op.gt]: 0 },
    farmerId: { [Op.notIn]: ctx.usedFarmers },
  };
}
function publicContext(ctx) {
  return { remainingQuantity: decimalString(ctx.remaining, 3), orderVersion: ctx.order.version };
}
function recommendation(match, target) {
  return {
    id: match.key,
    fulfilment: ['exact', 'excess', 'partial'][match.category],
    quantity: decimalString(match.quantity, 3),
    totalCost: decimalString(match.cost, 2),
    farmerCount: match.farmerCount,
    availableDate: match.availableDate,
    harvestDate: match.harvestDate,
    excessQuantity: decimalString(match.quantity > target ? match.quantity - target : 0n, 3),
    shortageQuantity: decimalString(match.quantity < target ? target - match.quantity : 0n, 3),
    listings: match.members.map((row) => ({
      ...marketListing(row, true, true),
      proposedQuantity: decimalString(
        match.farmerCount === 1 && amount(row.quantity) > target ? target : amount(row.quantity),
        3,
      ),
    })),
  };
}
export async function replacementRecommendations(buyerId, orderId, query = {}) {
  const { sort } = collectiveMatchQuery(query);
  return sequelize.transaction(transactionRead, async (transaction) => {
    const ctx = await context(buyerId, orderId, transaction);
    if (!ctx.remaining) return { ...publicContext(ctx), sort, recommendations: [] };
    const rows = await models.CropListing.findAll({
      where: candidateWhere(ctx),
      attributes: candidateAttributes,
      include: [marketFarmerJoin(true)],
      transaction,
    });
    const singles = rows
      .map((row) => {
        const quantity =
          amount(row.quantity) < ctx.remaining ? amount(row.quantity) : ctx.remaining;
        return {
          key: row.id,
          members: [row],
          category: quantity === ctx.remaining ? 0 : 2,
          quantity,
          cost: lineCost(decimalString(quantity, 3), row.pricePerUnit),
          farmerCount: 1,
          availableDate: row.availableDate,
          harvestDate: row.harvestDate,
          proximity: administrativeProximity([row]),
        };
      })
      .sort(combinationComparator(sort))
      .slice(0, 5);
    const combined = await bestCollectiveCombinations(rows, decimalString(ctx.remaining, 3), sort);
    const matches = [...singles, ...combined].sort(combinationComparator(sort)).slice(0, 5);
    return {
      ...publicContext(ctx),
      sort,
      recommendations: matches.map((match) => recommendation(match, ctx.remaining)),
    };
  });
}
export async function replacementListings(buyerId, orderId, input = {}) {
  const query = replacementListingQuery(input);
  return sequelize.transaction(transactionRead, async (transaction) => {
    const ctx = await context(buyerId, orderId, transaction);
    if (!ctx.remaining)
      return { ...publicContext(ctx), listings: [], total: 0, page: query.page, pages: 1 };
    const where = candidateWhere(ctx),
      conditions = [];
    for (const key of ['district', 'upazila'])
      if (query[key])
        conditions.push(
          sqlWhere(fn('LOCATE', query[key], col(`CropListing.${key}`)), { [Op.gt]: 0 }),
        );
    if (conditions.length) where[Op.and] = conditions;
    const { rows, count } = await models.CropListing.findAndCountAll({
      where,
      attributes: candidateAttributes,
      include: [marketFarmerJoin(true)],
      limit: 12,
      offset: (query.page - 1) * 12,
      order: [replacementListingSorts[query.sort], ['id', 'ASC']],
      transaction,
    });
    return {
      ...publicContext(ctx),
      listings: rows.map((row) => marketListing(row, true, true)),
      total: count,
      page: query.page,
      pages: Math.max(1, Math.ceil(count / 12)),
    };
  });
}
async function preview(ctx, input, transaction) {
  const ids = replacementSelection(input);
  if (!ctx.remaining) throw changed();
  const rows = [],
    items = [],
    farmers = new Map();
  for (const id of ids) {
    const row = await models.CropListing.findOne({
      where: { id, ...candidateWhere(ctx) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw changed();
    if (!farmers.has(row.farmerId)) {
      const farmer = await models.User.findOne({
        where: { id: row.farmerId, role: 'farmer', phoneVerifiedAt: { [Op.ne]: null } },
        attributes: ['fullName', 'phone'],
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
      if (!farmer) throw changed();
      farmers.set(row.farmerId, farmer);
    }
    const quantity =
      ids.length === 1 && amount(row.quantity) > ctx.remaining
        ? ctx.remaining
        : amount(row.quantity);
    rows.push(row);
    items.push({
      listingId: row.id,
      listingVersion: row.version,
      farmerId: row.farmerId,
      quantity: decimalString(quantity, 3),
      subtotal: decimalString(lineCost(decimalString(quantity, 3), row.pricePerUnit), 2),
      snapshot: orderItemSnapshot(row, farmers.get(row.farmerId)),
    });
  }
  const total = items.reduce((sum, item) => sum + amount(item.quantity), 0n);
  if (total * 5n > ctx.remaining * 6n)
    throw new AppError(
      409,
      'বেছে নেওয়া মজুত বাকি পরিমাণের ২০% অতিরিক্ত সীমা ছাড়িয়েছে। কম বিজ্ঞাপন বেছে নিন।',
    );
  const payload = {
    purpose: 'replacement',
    buyerId: ctx.order.buyerId,
    orderId: ctx.order.id,
    orderVersion: ctx.order.version,
    items: items.map((item) => ({
      id: item.listingId,
      version: item.listingVersion,
      quantity: item.quantity,
    })),
  };
  return {
    rows,
    items,
    snapshot: { ...ctx.order.snapshot, requestedQuantity: decimalString(ctx.remaining, 3) },
    mode: ids.length === 1 ? 'individual' : 'collective',
    totalQuantity: decimalString(total, 3),
    totalCost: decimalString(
      items.reduce((sum, item) => sum + scaledDecimal(item.subtotal, 2), 0n),
      2,
    ),
    token: signQuote(payload),
  };
}
export async function previewReplacement(buyerId, orderId, input, parentTransaction) {
  return sequelize.transaction({ ...transactionWrite, transaction: parentTransaction }, async (transaction) => {
    const ctx = await context(buyerId, orderId, transaction, true),
      result = await preview(ctx, input, transaction);
    return {
      preview: {
        ...publicPreview(result),
        afterQuantity: decimalString(
          amount(ctx.summary.currentQuantity) + amount(result.totalQuantity),
          3,
        ),
        afterCost: decimalString(
          scaledDecimal(ctx.summary.currentCost, 2) + scaledDecimal(result.totalCost, 2),
          2,
        ),
      },
      quoteToken: result.token,
    };
  });
}
export async function confirmReplacement(buyerId, orderId, input, parentTransaction) {
  const { quoteToken, requestId } = orderSubmission(input),
    requestHash = createHash('sha256').update(quoteToken).digest('hex');
  return sequelize.transaction({ ...transactionWrite, transaction: parentTransaction }, async (transaction) => {
    const ctx = await context(buyerId, orderId, transaction, true);
    const existing = await models.OrderReplacement.findOne({
      where: { buyerId, requestId },
      transaction,
    });
    if (existing) {
      if (existing.orderId !== orderId || existing.requestHash !== requestHash) throw changed();
      return {
        order: await fetchOrder({ id: buyerId, role: 'buyer' }, orderId, transaction),
        created: false,
      };
    }
    const quote = openQuote(quoteToken, buyerId);
    if (
      quote.purpose !== 'replacement' ||
      quote.orderId !== orderId ||
      quote.orderVersion !== ctx.order.version
    )
      throw changed();
    const result = await preview(
      ctx,
      { listingIds: quote.items.map((item) => item.id) },
      transaction,
    );
    if (result.token !== quoteToken) throw changed();
    const batch = await models.OrderReplacement.create(
      { orderId, buyerId, requestId, requestHash },
      { transaction },
    );
    await addOrderPortions(ctx.order, result.items, transaction, batch.id);
    await reserveOrderItems(result.rows, result.items, transaction);
    await ctx.order.update(
      { version: ctx.order.version + 1, updatedAt: new Date() },
      { transaction },
    );
    await models.Notification.create(
      {
        recipientId: buyerId,
        orderId,
        title: 'অর্ডারে বিকল্প কৃষক যুক্ত হয়েছে',
        message: `${ctx.order.snapshot.cropName}-এর অর্ডারে আপনার বেছে নেওয়া বিকল্প সরবরাহ যুক্ত হয়েছে ও মজুত সংরক্ষিত আছে। নতুন কৃষকদের উত্তরের অগ্রগতি অর্ডারে দেখুন।`,
      },
      { transaction },
    );
    return {
      order: await fetchOrder({ id: buyerId, role: 'buyer' }, orderId, transaction),
      created: true,
    };
  });
}
