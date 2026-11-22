import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { listBuyerApplications, reviewBuyerApplication } from '../services/admin.js';
import { AppError } from '../lib/errors.js';

export const adminRouter = Router();
adminRouter.use(...requireRole('admin'));
adminRouter.get('/buyers', async (req, res) =>
  res.json({ success: true, ...(await listBuyerApplications(req.query)) }),
);
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
