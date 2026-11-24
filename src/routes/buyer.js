import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { resubmitBuyer, editBuyerIdentity } from '../services/buyers.js';
import { publicUser } from '../services/auth.js';
import { requirementsRouter } from './requirements.js';
import { buyerDocumentsUpload } from '../lib/buyer-document-upload.js';
import { models } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { buyerDocumentDirectory } from '../services/buyer-documents.js';

export const buyerRouter = Router();
buyerRouter.use(...requireRole('buyer'));
buyerRouter.use('/requirements', requirementsRouter);
buyerRouter.get('/documents', async (req, res) => {
  const documents = await models.BuyerDocument.findAll({
    where: { buyerId: req.user.id },
    attributes: ['id', 'documentType', 'contentType', 'createdAt'],
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
  });
  res.json({
    success: true,
    documents: documents.map((document) => ({
      id: document.id,
      documentType: document.documentType,
      contentType: document.contentType,
      uploadedAt: document.createdAt,
      url: `/api/buyer/documents/${document.id}`,
    })),
  });
});
buyerRouter.get('/documents/:documentId', async (req, res) => {
  if (!/^[a-f0-9-]{36}$/.test(req.params.documentId))
    throw new AppError(404, 'নথিটি পাওয়া যায়নি।');
  const document = await models.BuyerDocument.findOne({
    where: { id: req.params.documentId, buyerId: req.user.id },
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
buyerRouter.post('/resubmit', buyerDocumentsUpload, async (req, res) => {
  const user = await resubmitBuyer(req.user.id, req.body || {}, req.files);
  res.json({ success: true, message: 'সংশোধিত আবেদন আবার জমা হয়েছে।', user: publicUser(user) });
});
buyerRouter.patch('/profile', async (req, res) => {
  const user = await editBuyerIdentity(req.user.id, req.body);
  res.json({ success: true, message: 'আপনার নাম ও ইমেইল সংরক্ষণ হয়েছে।', user: publicUser(user) });
});
