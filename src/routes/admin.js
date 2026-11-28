import { categories, changeAccess, directory, moderateListing, platformReport, writeCategory } from '../services/admin-panel.js';
import { photoFilenamePattern } from '../lib/listing-validation.js';
import { listingPhotoDirectory } from '../services/listing-photos.js';
import { uuidPattern } from '../lib/order-validation.js';
import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { listBuyerApplications, reviewBuyerApplication } from '../services/admin.js';
import { AppError } from '../lib/errors.js';
import { models } from '../models/index.js';
import { buyerDocumentDirectory } from '../services/buyer-documents.js';

export const adminRouter = Router();
adminRouter.use(...requireRole('admin'));
adminRouter.get('/buyers', async (req, res) =>
  res.json({ success: true, ...(await listBuyerApplications(req.query)) }),
);
adminRouter.get('/buyers/:userId/documents/:documentId', async (req, res) => {
  if (!/^[a-f0-9-]{36}$/.test(req.params.userId) || !/^[a-f0-9-]{36}$/.test(req.params.documentId))
    throw new AppError(404, 'নথিটি পাওয়া যায়নি।');
  const document = await models.BuyerDocument.findOne({
    where: { id: req.params.documentId, buyerId: req.params.userId },
  });
  if (!document) throw new AppError(404, 'নথিটি পাওয়া যায়নি।');
  res.set({
    'Content-Type': document.contentType,
    'Content-Disposition': `inline; filename="buyer-document.${document.contentType === 'application/pdf' ? 'pdf' : 'webp'}"`,
    'X-Content-Type-Options': 'nosniff',
  });
  res.sendFile(document.filename, { root: buyerDocumentDirectory, cacheControl: false }, (error) => {
    if (error && !res.headersSent)
      res.status(404).json({ success: false, message: 'নথিটি পাওয়া যায়নি।' });
  });
});
adminRouter.post('/buyers/:userId/review', async (req, res) => {
  if (!/^[a-f0-9-]{36}$/.test(req.params.userId))
    throw new AppError(404, 'ক্রেতার আবেদন পাওয়া যায়নি।');
  const buyer = await reviewBuyerApplication(req.user.id, req.params.userId, req.body);
  res.json({
    success: true,
    message:
      buyer.status === 'approved'
        ? 'ক্রেতার আবেদন অনুমোদিত হয়েছে।'
        : 'কারণসহ আবেদন প্রত্যাখ্যান করা হয়েছে।',
    buyer,
  });
});

adminRouter.get('/overview', async (req, res) => res.json(await platformReport(req.query)));
for (const section of ['users', 'listings', 'requirements', 'orders']) {
  adminRouter.get(`/${section}`, async (req, res) => res.json(await directory(section, req.query)));
}
adminRouter.patch('/users/:id/access', async (req, res) => {
  await changeAccess(req.params.id, req.body);
  res.json({ success: true });
});
adminRouter.patch('/listings/:id/visibility', async (req, res) => {
  await moderateListing(req.params.id, req.body);
  res.json({ success: true });
});
adminRouter.get('/categories', async (_req, res) => res.json({ categories: await categories() }));
adminRouter.post('/categories', async (req, res) => {
  res.status(201).json({ category: await writeCategory(null, req.body) });
});
adminRouter.put('/categories/:id', async (req, res) => {
  res.json({ category: await writeCategory(req.params.id, req.body) });
});
adminRouter.delete('/categories/:id', async (req, res) => {
  await writeCategory(req.params.id, req.body, true);
  res.json({ success: true });
});

adminRouter.get('/listings/:id/photos/:file', async (req, res) => {
  const { id, file } = req.params;
  if (!uuidPattern.test(id) || !photoFilenamePattern.test(file)) throw new AppError(404, 'ছবিটি পাওয়া যায়নি।');
  const listing = await models.CropListing.findByPk(id, { attributes: ['photoFilenames'] });
  if (!listing?.photoFilenames.includes(file)) throw new AppError(404, 'ছবিটি পাওয়া যায়নি।');
  res.sendFile(file, { root: listingPhotoDirectory, cacheControl: false });
});
