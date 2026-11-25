import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { photoFilenamePattern } from '../lib/listing-validation.js';
import { listingPhotoDirectory } from '../services/listing-photos.js';
import { editFarmerProfile } from '../services/farmers.js';
import {
  listOwnListings,
  findOwnListing,
  ownListing,
  createListing,
  editListing,
  changeListingStatus,
  removeListing,
} from '../services/listings.js';

export const farmerRouter = Router();
farmerRouter.use(...requireRole('farmer'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 5, fields: 20, fieldSize: 8192, parts: 25 },
  fileFilter(_req, file, callback) {
    callback(
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        ? null
        : new AppError(422, 'ছবির ফরম্যাট সঠিক নয়।', { photos: 'JPG, PNG অথবা WebP ছবি দিন।' }),
      true,
    );
  },
}).array('photos', 5);

function photos(req, res, next) {
  upload(req, res, (error) => {
    if (error?.name === 'MulterError')
      return next(
        new AppError(422, 'ছবি বা তথ্য আপলোড করা যায়নি।', {
          photos:
            'সর্বোচ্চ ৫টি ছবি দিন; প্রতিটি সর্বোচ্চ ২ মেগাবাইট। ফর্মের তথ্যও নির্ধারিত সীমার মধ্যে রাখুন।',
        }),
      );
    next(error);
  });
}

const writeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res
      .status(429)
      .json({ success: false, message: 'অল্প সময়ে অনেকবার পরিবর্তন করেছেন। কিছুক্ষণ পরে চেষ্টা করুন।' }),
});

const profilePhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 8, fieldSize: 4096 },
  fileFilter(_req, file, callback) {
    callback(
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        ? null
        : new AppError(422, 'ছবির ফরম্যাট সঠিক নয়।', { photo: 'JPG, PNG অথবা WebP ছবি দিন।' }),
      true,
    );
  },
}).single('photo');

farmerRouter.patch('/profile', writeLimit, profilePhoto, async (req, res) => {
  const user = await editFarmerProfile(req.user.id, req.body, req.file);
  res.json({ success: true, user, message: 'আপনার প্রোফাইলের তথ্য সংরক্ষণ হয়েছে।' });
});

farmerRouter.get('/listings', async (req, res) => {
  res.json({ success: true, ...(await listOwnListings(req.user.id, req.query)) });
});
farmerRouter.get('/listings/:id', async (req, res) => {
  res.json({
    success: true,
    listing: ownListing(await findOwnListing(req.user.id, req.params.id)),
  });
});
farmerRouter.get('/listings/:id/photos/:filename', async (req, res) => {
  if (!photoFilenamePattern.test(req.params.filename))
    throw new AppError(404, 'ছবিটি পাওয়া যায়নি।');
  const row = await findOwnListing(req.user.id, req.params.id);
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
farmerRouter.post('/listings', writeLimit, photos, async (req, res) => {
  const listing = await createListing(req.user.id, req.body || {}, req.files);
  res.status(201).json({ success: true, message: 'ফসলের বিজ্ঞাপন প্রকাশ হয়েছে।', listing });
});
farmerRouter.put('/listings/:id', writeLimit, photos, async (req, res) => {
  const listing = await editListing(req.user.id, req.params.id, req.body || {}, req.files);
  res.json({ success: true, message: 'বিজ্ঞাপনের তথ্য সংরক্ষণ হয়েছে।', listing });
});
farmerRouter.patch('/listings/:id/status', writeLimit, async (req, res) => {
  const listing = await changeListingStatus(req.user.id, req.params.id, req.body);
  res.json({ success: true, message: 'বিজ্ঞাপনের অবস্থা পরিবর্তন হয়েছে।', listing });
});
farmerRouter.delete('/listings/:id', writeLimit, async (req, res) => {
  await removeListing(req.user.id, req.params.id, req.body);
  res.json({ success: true, message: 'বিজ্ঞাপনটি মুছে ফেলা হয়েছে।' });
});
