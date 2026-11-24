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
