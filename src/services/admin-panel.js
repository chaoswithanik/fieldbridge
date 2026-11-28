import { Op, fn, col } from 'sequelize';
import { models } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { uuidPattern, onlyOrderFields } from '../lib/order-validation.js';
import { cropCatalog } from '../../shared/crop-catalog.js';
import { directoryFilters, normalizeDirectoryFilters } from '../../shared/admin-directory-filters.js';
import { listingLocationConditions } from '../lib/location.js';
import { fetchOrder } from './orders.js';

const invalid = () => new AppError(422, 'অনুরোধের তথ্য সঠিক নয়।');
const missing = () => new AppError(404, 'তথ্যটি পাওয়া যায়নি।');
const stale = () => new AppError(409, 'তথ্য বদলেছে। তালিকা হালনাগাদ করে আবার চেষ্টা করুন।');
const checkId = (id) => { if (!uuidPattern.test(id)) throw missing(); };
const includePerson = (as) => ({ model: models.User, as, attributes: ['fullName', 'phone'] });

export async function directory(section, query) {
  const fields = directoryFilters[section];
  onlyOrderFields(query, ['page', 'q', 'from', 'to', ...fields.map(field => field.key)]);
  if (Object.values(query).some(value => typeof value !== 'string')) throw invalid();
  const values = normalizeDirectoryFilters(section, query);
  const { page = '1', q = '', filter, from, to } = values;
  if (!/^[1-9]\d{0,4}$/.test(page) || q.length > 100) throw invalid();
  for (const { key, options } of fields) {
    if (values[key] && !options.some(([id]) => id === values[key])) throw invalid();
  }
  const sources = {
    users: [models.User, ['fullName', 'phone', 'email']],
    listings: [models.CropListing, ['cropName', 'district']],
    requirements: [models.PurchaseRequirement, ['cropName', 'deliveryAddress']],
    orders: [models.Order, ['id']],
  };
  const [model, searchFields] = sources[section];
  const where = {};
  const options = {};
  if (from || to) {
    const startOfDay = (day) => {
      const utc = new Date(day + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < '1000-01-01' || !Number.isFinite(+utc) ||
          utc.toISOString().slice(0, 10) !== day) throw invalid();
      return new Date(day + 'T00:00:00+06:00');
    };
    if (from && to && from > to) throw new AppError(422, 'শেষ তারিখ শুরুর তারিখের আগে হতে পারে না।');
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = startOfDay(from);
    if (to) where.createdAt[Op.lt] = new Date(+startOfDay(to) + 86400000);
  }
  if (values.crop) where.cropId = values.crop;
  if (values.unit) where.unit = values.unit;
  if (values.district) where[Op.and] = listingLocationConditions({ district: values.district });
  if (values.visibility) where.hiddenByAdmin = values.visibility === 'hidden';
  if (values.mode) where.mode = values.mode;
  if (q.trim()) where[Op.or] = searchFields.map((field) => ({ [field]: { [Op.substring]: q.trim() } }));
  if (section === 'users') {
    where.role = ['buyer', 'farmer'].includes(filter) ? filter : { [Op.in]: ['farmer', 'buyer'] };
    if (values.access) where.blocked = values.access === 'blocked';
    options.attributes = ['id', 'role', 'fullName', 'phone', 'email', 'blocked', 'createdAt'];
  } else if (section === 'orders') {
    if (filter) where.completedAt = filter === 'completed' ? { [Op.ne]: null } : null;
    options.attributes = ['id'];
  } else {
    if (filter) where.status = filter;
    options.include = [includePerson(section === 'listings' ? 'farmer' : 'buyer')];

  }
  const { rows, count } = await model.findAndCountAll({
    ...options, where, limit: 15, offset: (Number(page) - 1) * 15, order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  let records = rows;
  if (section === 'orders') records = await Promise.all(rows.map(({ id }) => fetchOrder({ role: 'admin' }, id)));
  if (section === 'listings') records = rows.map((row) => {
    const { photoFilenames, ...listing } = row.toJSON();
    return { ...listing, photos: photoFilenames.map(file => `/api/admin/listings/${row.id}/photos/${file}`) };
  });
  return { records, total: count, pages: Math.max(1, Math.ceil(count / 15)), page: Number(page) };
}

export async function changeAccess(id, input) {
  checkId(id);
  onlyOrderFields(input, ['blocked']);
  if (typeof input.blocked !== 'boolean') throw invalid();
  await sequelize.transaction(async (transaction) => {
    const user = await models.User.findOne({ where: { id, role: ['buyer', 'farmer'] }, transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw missing();
    await user.update({ blocked: input.blocked }, { transaction });
    if (input.blocked) await models.AuthSession.destroy({ where: { userId: id }, transaction });
  });
}

export async function moderateListing(id, input) {
  checkId(id);
  onlyOrderFields(input, ['hidden', 'version']);
  if (typeof input.hidden !== 'boolean' || !Number.isSafeInteger(input.version)) throw invalid();
  await sequelize.transaction(async (transaction) => {
    const row = await models.CropListing.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw missing();
    if (row.version !== input.version) throw stale();
    await row.update({ hiddenByAdmin: input.hidden, version: row.version + 1 }, { transaction });
  });
}

export function categories() {
  return models.CropCategory.findAll({ order: [['name', 'ASC']] });
}
export async function writeCategory(id, input, remove = false) {
  if (id) checkId(id);
  onlyOrderFields(input, remove ? ['version'] : id ? ['version', 'name', 'cropIds'] : ['name', 'cropIds']);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const ids = input.cropIds;
  if (!remove && (!name || name.length > 80 || !Array.isArray(ids) || !ids.length ||
      ids.length > cropCatalog.length || new Set(ids).size !== ids.length ||
      ids.some((value) => !cropCatalog.some((crop) => crop.id === value)))) throw invalid();
  try {
    return await sequelize.transaction(async (transaction) => {
      if (!id) return models.CropCategory.create({ name, cropIds: ids }, { transaction });
      const row = await models.CropCategory.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw missing();
      if (row.version !== input.version) throw stale();
      if (remove) return row.destroy({ transaction });
      return row.update({ name, cropIds: ids, version: row.version + 1 }, { transaction });
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') throw new AppError(409, 'এই নামে একটি শ্রেণি রয়েছে।');
    throw error;
  }
}

export async function platformReport(query) {
  onlyOrderFields(query, ['days']);
  const days = Number(query.days ?? 30);
  if (![7, 30, 90].includes(days)) throw invalid();
  const since = { [Op.gte]: new Date(Date.now() - days * 86400000) };
  const { User, CropListing, PurchaseRequirement, Order, OrderPortion, BuyerProfile } = models;
  const [farmers, buyers, pending, listings, requirements, orders, newOrders, completed, deliveries, newUsers, cash] =
    await Promise.all([
      User.count({ where: { role: 'farmer' } }), User.count({ where: { role: 'buyer' } }),
      BuyerProfile.count({ where: { status: 'pending' } }), CropListing.count(),
      PurchaseRequirement.count(), Order.count(), Order.count({ where: { createdAt: since } }),
      Order.count({ where: { completedAt: since } }), OrderPortion.count({ where: { deliveryConfirmedAt: since } }),
      User.count({ where: { createdAt: since, role: ['farmer', 'buyer'] } }),
      OrderPortion.findOne({ attributes: [[fn('SUM', col('total_cost')), 'amount']], where: { deliveryConfirmedAt: since }, raw: true }),
    ]);
  return { totals: { farmers, buyers, pending, listings, requirements, orders },
    report: { days, newUsers, newOrders, completed, deliveries, cash: String(cash.amount || '0.00') } };
}
