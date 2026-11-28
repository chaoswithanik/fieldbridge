import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import {
  replacementRecommendations,
  replacementListings,
  previewReplacement,
  confirmReplacement,
} from '../services/replacements.js';
import {
  previewOrder,
  placeOrder,
  readOrder,
  listOrders,
  respondToOrder,
  updatePortionProgress,
} from '../services/orders.js';
export const ordersRouter = Router();
ordersRouter.use(...requireRole(['buyer', 'farmer']));
const mutations = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: 'অল্প সময়ে অনেক অনুরোধ করেছেন। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
    }),
});
const buyer = (req, _res, next) => {
  if (req.user.role !== 'buyer')
    throw new AppError(403, 'শুধু অনুমোদিত ক্রেতা অর্ডার দিতে পারবেন।');
  next();
};
ordersRouter.get('/', async (req, res) =>
  res.json({ success: true, ...(await listOrders(req.user, req.query)) }),
);
ordersRouter.post('/quote', buyer, mutations, async (req, res) =>
  res.json({ success: true, ...(await previewOrder(req.user.id, req.body)) }),
);
ordersRouter.post('/', buyer, mutations, async (req, res) => {
  const { order, created } = await placeOrder(req.user.id, req.body);
  res
    .status(created ? 201 : 200)
    .json({ success: true, order, message: 'অর্ডার তৈরি হয়েছে। মজুত সংরক্ষিত আছে।' });
});
ordersRouter.post('/portions/:id/respond', mutations, async (req, res) => {
  if (req.user.role !== 'farmer')
    throw new AppError(403, 'শুধু সংশ্লিষ্ট কৃষক নিজের অংশের উত্তর দিতে পারবেন।');
  res.json({
    success: true,
    order: await respondToOrder(req.user.id, req.params.id, req.body),
    message: 'আপনার উত্তর সংরক্ষিত হয়েছে।',
  });
});
ordersRouter.post('/portions/:id/progress', mutations, async (req, res) => {
  if (req.user.role !== 'farmer')
    throw new AppError(403, 'শুধু সংশ্লিষ্ট কৃষক সরবরাহের অগ্রগতি বদলাতে পারবেন।');
  const order = await updatePortionProgress(req.user.id, req.params.id, req.body);
  res.json({ success: true, order, message: 'সরবরাহের অগ্রগতি সংরক্ষিত হয়েছে।' });
});
ordersRouter.get('/:id', async (req, res) =>
  res.json({ success: true, order: await readOrder(req.user, req.params.id) }),
);
ordersRouter.get('/:id/replacements', buyer, async (req, res) =>
  res.json({
    success: true,
    ...(await replacementRecommendations(req.user.id, req.params.id, req.query)),
  }),
);
ordersRouter.get('/:id/replacements/listings', buyer, async (req, res) =>
  res.json({
    success: true,
    ...(await replacementListings(req.user.id, req.params.id, req.query)),
  }),
);
ordersRouter.post('/:id/replacements/quote', buyer, mutations, async (req, res) =>
  res.json({ success: true, ...(await previewReplacement(req.user.id, req.params.id, req.body)) }),
);
ordersRouter.post('/:id/replacements', buyer, mutations, async (req, res) => {
  const { order, created } = await confirmReplacement(req.user.id, req.params.id, req.body);
  res.status(created ? 201 : 200).json({
    success: true,
    order,
    message: 'আপনার বেছে নেওয়া বিকল্প সরবরাহ অর্ডারে যুক্ত হয়েছে। মজুত সংরক্ষিত আছে।',
  });
});
