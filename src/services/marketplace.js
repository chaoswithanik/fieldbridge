import { resolveCropName, searchCropCatalog } from '../../shared/crop-catalog.js';
import { Op, fn, col, where as sqlWhere } from 'sequelize';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { canViewMarketDetails, marketplaceQuery } from '../lib/marketplace-validation.js';

const visibleFields = [
  'id',
  'cropId',
  'varietyId',
  'cropName',
  'quantity',
  'unit',
  'harvestDate',
  'availableDate',
  'district',
  'upazila',
  'photoFilenames',
  'createdAt',
];
const activeWhere = { status: 'active', quantity: { [Op.gt]: 0 } };

export function marketFarmerJoin(details = false) {
  return {
    model: models.User,
    as: 'farmer',
    required: true,
    attributes: details ? ['fullName', 'phone'] : [],
    where: { role: 'farmer', phoneVerifiedAt: { [Op.ne]: null } },
    include: [
      {
        model: models.FarmerProfile,
        as: 'farmerProfile',
        required: true,
        attributes: details ? ['farmName'] : [],
      },
    ],
  };
}

export function marketListing(row, fullAccess = false, detail = false) {
  return {
    id: row.id,
    cropId: row.cropId,
    varietyId: row.varietyId,
    cropName: row.cropName,
    quantity: row.quantity,
    unit: row.unit,
    harvestDate: row.harvestDate,
    availableDate: row.availableDate,
    district: row.district,
    upazila: row.upazila,
    createdAt: row.createdAt,
    photos: row.photoFilenames.map((filename) => ({
      url: `/api/marketplace/listings/${row.id}/photos/${filename}`,
    })),
    ...(fullAccess ? { pricePerUnit: row.pricePerUnit } : {}),
    ...(fullAccess && detail
      ? {
          description: row.description,
          farmAddress: row.farmAddress,
          farmer: {
            fullName: row.farmer.fullName,
            phone: row.farmer.phone,
            farmName: row.farmer.farmerProfile.farmName,
            farmAddress: row.farmAddress,
          },
        }
      : {}),
  };
}

export function marketAccess(user) {
  const full = Boolean(canViewMarketDetails(user));
  return { canViewPrices: full, canViewFarmerDetails: full };
}

export async function searchMarketListings(user, query) {
  const full = Boolean(canViewMarketDetails(user));
  const values = marketplaceQuery(query, full);
  const where = { ...activeWhere };
  const conditions = [];
  if (values.q) {
    const exact = resolveCropName(values.q);
    const selections = exact ? [exact] : searchCropCatalog(values.q);
    const nameContains = sqlWhere(fn('LOCATE', values.q, col('CropListing.crop_name')), { [Op.gt]: 0 });
    conditions.push({ [Op.or]: [
      ...(exact ? [{ cropId: null, [Op.and]: [nameContains] }] : [nameContains]),
      ...selections.map(({ cropId, varietyId }) => ({ cropId, ...(varietyId ? { varietyId } : {}) })),
    ] });
  }
  for (const [key, column] of [
    ['district', 'district'],
    ['upazila', 'upazila'],
  ])
    if (values[key])
      conditions.push(
        sqlWhere(fn('LOCATE', values[key], col(`CropListing.${column}`)), { [Op.gt]: 0 }),
      );
  if (conditions.length) where[Op.and] = conditions;
  if (values.unit) where.unit = values.unit;
  for (const [field, min, max] of [
    ['quantity', 'minQuantity', 'maxQuantity'],
    ['pricePerUnit', 'minPrice', 'maxPrice'],
    ['harvestDate', 'harvestFrom', 'harvestTo'],
    ['availableDate', 'availableFrom', 'availableTo'],
  ]) {
    if (values[min] !== undefined || values[max] !== undefined)
      where[field] = {
        ...(field === 'quantity' ? { [Op.gt]: 0 } : {}),
        ...(values[min] !== undefined ? { [Op.gte]: values[min] } : {}),
        ...(values[max] !== undefined ? { [Op.lte]: values[max] } : {}),
      };
  }
  const orders = {
    newest: ['createdAt', 'DESC'],
    available_asc: ['availableDate', 'ASC'],
    harvest_asc: ['harvestDate', 'ASC'],
    price_asc: ['pricePerUnit', 'ASC'],
    price_desc: ['pricePerUnit', 'DESC'],
    quantity_desc: ['quantity', 'DESC'],
  };
  const { rows, count } = await models.CropListing.findAndCountAll({
    where,
    attributes: [...visibleFields, ...(full ? ['pricePerUnit'] : [])],
    include: [marketFarmerJoin()],
    limit: 12,
    offset: (values.page - 1) * 12,
    order: [orders[values.sort], ['id', 'DESC']],
  });
  return {
    listings: rows.map((row) => marketListing(row, full)),
    total: count,
    page: values.page,
    pages: Math.max(1, Math.ceil(count / 12)),
    access: marketAccess(user),
  };
}

export async function findMarketListing(id, { full = false, photo = false } = {}) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
    throw new AppError(404, 'বিজ্ঞাপনটি এখন বাজারে পাওয়া যাচ্ছে না।');
  const row = await models.CropListing.findOne({
    where: { id, ...activeWhere },
    attributes: photo
      ? ['id', 'photoFilenames']
      : [...visibleFields, ...(full ? ['pricePerUnit', 'description', 'farmAddress'] : [])],
    include: [marketFarmerJoin(full && !photo)],
  });
  if (!row) throw new AppError(404, 'বিজ্ঞাপনটি এখন বাজারে পাওয়া যাচ্ছে না।');
  return row;
}
