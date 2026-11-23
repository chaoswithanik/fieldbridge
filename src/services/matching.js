import { Op, Transaction } from 'sequelize';
import { sequelize } from '../config/database.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { individualMatchQuery, individualMatchSorts } from '../lib/matching-validation.js';
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
        throw new AppError(403, 'মিলে যাওয়া ফসল দেখতে ক্রেতার অনুমোদন প্রয়োজন।');
      const requirement = await findOwnRequirement(buyerId, id, transaction);
      const { rows, count } = await models.CropListing.findAndCountAll({
        where: {
          cropName: requirement.cropName,
          unit: requirement.unit,
          status: 'active',
          quantity: { [Op.gte]: requirement.quantity, [Op.gt]: 0 },
        },
        attributes: [
          'id',
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
