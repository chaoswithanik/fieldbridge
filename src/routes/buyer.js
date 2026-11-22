import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { resubmitBuyer, editBuyerIdentity } from '../services/buyers.js';
import { publicUser } from '../services/auth.js';

export const buyerRouter = Router();
buyerRouter.use(...requireRole('buyer'));
buyerRouter.post('/resubmit', async (req, res) => {
  const user = await resubmitBuyer(req.user.id, req.body);
  res.json({ success: true, message: 'সংশোধিত আবেদন আবার জমা হয়েছে।', user: publicUser(user) });
});
buyerRouter.patch('/profile', async (req, res) => {
  const user = await editBuyerIdentity(req.user.id, req.body);
  res.json({ success: true, message: 'আপনার নাম ও ইমেইল সংরক্ষণ হয়েছে।', user: publicUser(user) });
});
