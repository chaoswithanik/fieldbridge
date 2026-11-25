import { sequelize } from '../config/database.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import {
  validateListing,
  listingStatuses,
  listingVersion,
  retainedPhotos,
} from '../lib/listing-validation.js';
import { saveListingPhotos, deleteListingPhotos } from './listing-photos.js';
import { scaledDecimal, decimalString } from '../lib/collective-matching.js';

const inputFields = [
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
  'retainedPhotos',
  'version',
];

function checkFields(input, allowed) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key))
  )
    throw new AppError(422, 'এই তথ্য পরিবর্তনের অনুমতি নেই।');
}

export function ownListing(row) {
  return {
    id: row.id,
    cropId: row.cropId,
    varietyId: row.varietyId,
    cropName: row.cropName,
    quantity: row.quantity,
    reservedQuantity: row.reservedQuantity,
    unit: row.unit,
    pricePerUnit: row.pricePerUnit,
    harvestDate: row.harvestDate,
    availableDate: row.availableDate,
    district: row.district,
    upazila: row.upazila,
    farmAddress: row.farmAddress,
    description: row.description,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    photos: row.photoFilenames.map((filename) => ({
      filename,
      url: `/api/farmer/listings/${row.id}/photos/${filename}`,
    })),
  };
}

export async function findOwnListing(farmerId, id, transaction) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
    throw new AppError(404, 'বিজ্ঞাপনটি খুঁজে পাওয়া যায়নি।');
  const row = await models.CropListing.findOne({
    where: { id, farmerId },
    ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!row) throw new AppError(404, 'বিজ্ঞাপনটি খুঁজে পাওয়া যায়নি।');
  return row;
}

function checkVersion(row, version) {
  if (row.version !== version)
    throw new AppError(409, 'বিজ্ঞাপনটি অন্য সময়ে বদলেছে। সর্বশেষ তথ্য আবার খুলে চেষ্টা করুন।');
}

function checkPhotoCount(count) {
  if (count < 1 || count > 5)
    throw new AppError(422, 'বিজ্ঞাপনে ১ থেকে ৫টি ছবি রাখুন।', {
      photos: 'অন্তত ১টি এবং সর্বোচ্চ ৫টি ছবি রাখুন।',
    });
}

export async function listOwnListings(farmerId, query = {}) {
  const status = query.status || 'all';
  const page = Number(query.page || 1);
  if (
    (status !== 'all' && !listingStatuses.includes(status)) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000
  )
    throw new AppError(422, 'পাতা বা বিজ্ঞাপনের অবস্থা সঠিক নয়।');
  const where = { farmerId, ...(status === 'all' ? {} : { status }) };
  const { rows, count } = await models.CropListing.findAndCountAll({
    where,
    limit: 12,
    offset: (page - 1) * 12,
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });
  const counts = Object.fromEntries(
    await Promise.all(
      listingStatuses.map(async (value) => [
        value,
        await models.CropListing.count({ where: { farmerId, status: value } }),
      ]),
    ),
  );
  return {
    listings: rows.map(ownListing),
    counts,
    total: count,
    page,
    pages: Math.max(1, Math.ceil(count / 12)),
  };
}

export async function createListing(farmerId, input, files = []) {
  checkFields(
    input,
    inputFields.filter((key) => key !== 'version'),
  );
  const values = validateListing(input);
  if (input.retainedPhotos !== undefined && retainedPhotos(input.retainedPhotos).length)
    throw new AppError(422, 'নতুন বিজ্ঞাপনের জন্য নতুন ছবি দিন।');
  checkPhotoCount(files.length);
  const filenames = await saveListingPhotos(files);
  try {
    return ownListing(
      await models.CropListing.create({ ...values, farmerId, photoFilenames: filenames }),
    );
  } catch (error) {
    await deleteListingPhotos(filenames);
    throw error;
  }
}

export async function editListing(farmerId, id, input, files = []) {
  checkFields(input, inputFields);
  const version = listingVersion(input.version);
  const current = await findOwnListing(farmerId, id);
  checkVersion(current, version);
  const values = validateListing(input, {
    existing: current,
    soldOut: current.status === 'sold_out' || scaledDecimal(current.reservedQuantity, 3) > 0n,
  });
  const kept = retainedPhotos(input.retainedPhotos);
  if (kept.some((name) => !current.photoFilenames.includes(name)))
    throw new AppError(422, 'নিজের বিজ্ঞাপনের ছবিই ব্যবহার করুন।');
  checkPhotoCount(kept.length + files.length);
  const added = await saveListingPhotos(files);
  let result;
  try {
    result = await sequelize.transaction(async (transaction) => {
      const row = await findOwnListing(farmerId, id, transaction);
      checkVersion(row, version);
      const held = scaledDecimal(row.reservedQuantity, 3);
      if (
        held > 0n &&
        (values.cropId !== row.cropId || values.varietyId !== row.varietyId ||
          values.cropName !== row.cropName || values.unit !== row.unit)
      )
        throw new AppError(
          409,
          'অর্ডারের জন্য মজুত সংরক্ষিত আছে। ফসলের নাম ও একক এখন বদলানো যাবে না।',
        );
      if (scaledDecimal(values.quantity, 3) + held > 999999999999n)
        throw new AppError(
          422,
          `সংরক্ষিত মজুতসহ মোট পরিমাণ সীমা ছাড়িয়েছে। উন্মুক্ত মজুত সর্বোচ্চ ${decimalString(999999999999n - held, 3)} দিন।`,
        );
      await row.update(
        { ...values, photoFilenames: [...kept, ...added], version: row.version + 1 },
        { transaction },
      );
      return ownListing(row);
    });
  } catch (error) {
    await deleteListingPhotos(added);
    throw error;
  }
  await deleteListingPhotos(current.photoFilenames.filter((name) => !kept.includes(name)));
  return result;
}

export async function changeListingStatus(farmerId, id, input) {
  checkFields(input, ['status', 'version']);
  if (!listingStatuses.includes(input.status))
    throw new AppError(422, 'বিজ্ঞাপনের অবস্থা সঠিক নয়।');
  const version = listingVersion(input.version);
  return sequelize.transaction(async (transaction) => {
    const row = await findOwnListing(farmerId, id, transaction);
    checkVersion(row, version);
    if (input.status === 'sold_out' && scaledDecimal(row.reservedQuantity, 3) > 0n)
      throw new AppError(
        409,
        'অর্ডারের জন্য মজুত সংরক্ষিত আছে। এখন বিক্রি শেষ চিহ্নিত করা যাবে না।',
      );
    if (input.status === 'active' && Number(row.quantity) <= 0)
      throw new AppError(422, 'চালু করার আগে সম্পাদনা করে মজুতের পরিমাণ শূন্যের বেশি দিন।', {
        quantity: 'বিজ্ঞাপন সম্পাদনা করে নতুন মজুতের পরিমাণ লিখুন।',
      });
    await row.update(
      {
        status: input.status,
        version: row.version + 1,
        ...(input.status === 'sold_out' ? { quantity: '0' } : {}),
      },
      { transaction },
    );
    return ownListing(row);
  });
}

export async function removeListing(farmerId, id, input) {
  checkFields(input, ['version']);
  const version = listingVersion(input.version);
  const photos = await sequelize.transaction(async (transaction) => {
    const row = await findOwnListing(farmerId, id, transaction);
    checkVersion(row, version);
    if (scaledDecimal(row.reservedQuantity, 3) > 0n)
      throw new AppError(409, 'অর্ডারের জন্য মজুত সংরক্ষিত আছে। বিজ্ঞাপনটি এখন মুছে ফেলা যাবে না।');
    const filenames = row.photoFilenames;
    await row.destroy({ transaction });
    return filenames;
  });
  await deleteListingPhotos(photos);
}
