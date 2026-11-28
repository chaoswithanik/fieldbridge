import { Router } from 'express';
import cookieParser from 'cookie-parser';
import { sequelize } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import { photoFilenamePattern } from '../lib/listing-validation.js';
import { currentUser, SESSION_COOKIE } from '../services/auth.js';
import { listingPhotoDirectory } from '../services/listing-photos.js';
import {
  searchMarketListings,
  findMarketListing,
  marketListing,
  marketAccess,
} from '../services/marketplace.js';

import { models } from '../models/index.js';

export const marketplaceRouter = Router();
marketplaceRouter.use(cookieParser());
marketplaceRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.vary('Cookie');
  if (!sequelize) throw new AppError(503, 'ফসলের বাজার এখন প্রস্তুত নয়। কিছুক্ষণ পরে চেষ্টা করুন।');
  next();
});

marketplaceRouter.get('/categories', async (_req, res) => {
  res.json({ categories: await models.CropCategory.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] }) });
});
marketplaceRouter.get('/listings/:id/photos/:filename', async (req, res) => {
  if (!photoFilenamePattern.test(req.params.filename))
    throw new AppError(404, 'ছবিটি পাওয়া যায়নি।');
  const row = await findMarketListing(req.params.id, { photo: true });
  if (!row.photoFilenames.includes(req.params.filename))
    throw new AppError(404, 'ছবিটি পাওয়া যায়নি।');
  res.sendFile(
    req.params.filename,
    { root: listingPhotoDirectory, cacheControl: false },
    (error) => {
      if (error && !res.headersSent)
        res.status(404).json({ success: false, message: 'ছবিটি পাওয়া যায়নি।' });
    },
  );
});
marketplaceRouter.get('/listings', async (req, res) => {
  const user = await currentUser(req.cookies[SESSION_COOKIE]);
  res.json({ success: true, ...(await searchMarketListings(user, req.query)) });
});
marketplaceRouter.get('/listings/:id', async (req, res) => {
  const user = await currentUser(req.cookies[SESSION_COOKIE]);
  const access = marketAccess(user);
  const row = await findMarketListing(req.params.id, { full: access.canViewFarmerDetails });
  res.json({ success: true, listing: marketListing(row, access.canViewPrices, true), access });
});
