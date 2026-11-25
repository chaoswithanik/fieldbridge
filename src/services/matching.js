import { matchingCropWhere } from '../lib/crop-identity.js';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import {
  individualMatchQuery,
  individualMatchSorts,
  collectiveMatchQuery,
} from '../lib/matching-validation.js';
import {
  bestCollectiveCombinations,
  requirementLotQuantities,
  scaledDecimal,
  decimalString,
} from '../lib/collective-matching.js';
import { findOwnRequirement, ownRequirement } from './requirements.js';
import { marketFarmerJoin, marketListing } from './marketplace.js';

export async function individualRequirementMatches(buyerId, id, query = {}) {
  const { sort, page } = individualMatchQuery(query);
  // Read a consistent requirement and stock snapshot. Approval edits wait for this read.
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
    async (transaction) => {
      const profile = await models.BuyerProfile.findByPk(buyerId, {
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      if (!profile || profile.status !== 'approved')
        throw new AppError(403, 'মিলে যাওয়া ফসল দেখতে ক্রেতার অনুমোদন নেই।');
      const requirement = await findOwnRequirement(buyerId, id, transaction);
      const { rows, count } = await models.CropListing.findAndCountAll({
        where: {
          ...matchingCropWhere(requirement),
          unit: requirement.unit,
          status: 'active',
          quantity: { [Op.gte]: requirement.quantity, [Op.gt]: 0 },
        },
        attributes: [
          'id',
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
          'photoFilenames',
          'createdAt',
          'farmAddress',
          'description',
        ],
        include: [marketFarmerJoin(true)],
        limit: 12,
        offset: (page - 1) * 12,
        order: [individualMatchSorts[sort], ['id', 'ASC']],
        transaction,
      });
      return {
        requirement: ownRequirement(requirement),
        listings: rows.map((row) => marketListing(row, true, true)),
        total: count,
        page,
        pages: Math.max(1, Math.ceil(count / 12)),
        sort,
      };
    },
  );
}

export async function collectiveRequirementMatches(buyerId, id, query = {}) {
  const { sort } = collectiveMatchQuery(query);
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
    async (transaction) => {
      const profile = await models.BuyerProfile.findByPk(buyerId, {
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      if (!profile || profile.status !== 'approved')
        throw new AppError(403, 'সম্মিলিত সরবরাহ দেখতে ক্রেতার অনুমোদন নেই।');
      const requirement = await findOwnRequirement(buyerId, id, transaction);
      const target = scaledDecimal(requirement.quantity, 3);
      const listings = await models.CropListing.findAll({
        where: {
          ...matchingCropWhere(requirement),
          unit: requirement.unit,
          status: 'active',
          quantity: { [Op.gt]: 0 },
        },
        attributes: [
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
          'photoFilenames',
          'createdAt',
          'farmAddress',
          'description',
        ],
        include: [marketFarmerJoin(true)],
        transaction,
      });
      const matches = await bestCollectiveCombinations(listings, requirement.quantity, sort, {
        prioritizeSingleFarm: true,
      });
      return {
        requirement: ownRequirement(requirement),
        sort,
        combinations: matches.map((match) => {
          const amounts = requirementLotQuantities(match.members, requirement.quantity);
          return {
            id: match.key,
            fulfilment: ['exact', 'excess', 'partial'][match.category],
            quantity: decimalString(match.quantity, 3),
            excessQuantity: decimalString(match.quantity > target ? match.quantity - target : 0n, 3),
            shortageQuantity: decimalString(
              match.quantity < target ? target - match.quantity : 0n,
              3,
            ),
            totalCost: decimalString(match.cost, 2),
            availableDate: match.availableDate,
            harvestDate: match.harvestDate,
            farmerCount: match.farmerCount,
            proximity: {
              sameUpazilaPairs: match.proximity.sameUpazilaPairs,
              sameDistrictPairs: match.proximity.sameDistrictPairs,
              differentDistrictPairs: match.proximity.differentDistrictPairs,
            },
            listings: match.members.map((listing) => ({
              ...marketListing(listing, true, true),
              proposedQuantity: decimalString(amounts.get(listing.id), 3),
              subtotal: decimalString(
                (amounts.get(listing.id) * scaledDecimal(listing.pricePerUnit, 2) + 500n) /
                  1000n,
                2,
              ),
            })),
          };
        }),
      };
    },
  );
}
