import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';
import { individualRequirementMatches } from '../services/matching.js';
import {
  listOwnRequirements,
  findOwnRequirement,
  ownRequirement,
  createRequirement,
  editRequirement,
  changeRequirementStatus,
  deleteRequirement,
} from '../services/requirements.js';

// Mounted after requireRole('buyer'); all responses inherit no-store and Origin checks.
export const requirementsRouter = Router();
requirementsRouter.use((req, _res, next) => {
  if (req.user.buyerProfile?.status !== 'approved')
    throw new AppError(403, 'চাহিদা পরিচালনার জন্য ক্রেতার অনুমোদন প্রয়োজন।');
  next();
});
const writeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: 'অল্প সময়ে অনেকবার পরিবর্তন করেছেন। কিছুক্ষণ পরে চেষ্টা করুন।',
    }),
});
requirementsRouter.get('/', async (req, res) => {
  res.json({ success: true, ...(await listOwnRequirements(req.user.id, req.query)) });
});
requirementsRouter.get('/:id', async (req, res) => {
  res.json({
    success: true,
    requirement: ownRequirement(await findOwnRequirement(req.user.id, req.params.id)),
  });
});
requirementsRouter.get('/:id/matches', async (req, res) => {
  res.json({
    success: true,
    ...(await individualRequirementMatches(req.user.id, req.params.id, req.query)),
  });
});
requirementsRouter.post('/', writeLimit, async (req, res) => {
  res.status(201).json({
    success: true,
    message: 'আপনার ক্রয় চাহিদা তৈরি হয়েছে।',
    requirement: await createRequirement(req.user.id, req.body),
  });
});
requirementsRouter.put('/:id', writeLimit, async (req, res) => {
  const result = await editRequirement(req.user.id, req.params.id, req.body);
  res.json({
    success: true,
    message: result.changed
      ? 'চাহিদার পরিবর্তন সংরক্ষণ হয়েছে।'
      : 'তথ্য অপরিবর্তিত আছে; কোনো সম্পাদনা ব্যবহার হয়নি।',
    requirement: result.requirement,
  });
});
requirementsRouter.patch('/:id/status', writeLimit, async (req, res) => {
  res.json({
    success: true,
    message: 'চাহিদার অবস্থা পরিবর্তন হয়েছে।',
    requirement: await changeRequirementStatus(req.user.id, req.params.id, req.body),
  });
});
requirementsRouter.delete('/:id', writeLimit, async (req, res) => {
  await deleteRequirement(req.user.id, req.params.id, req.body);
  res.json({ success: true, message: 'চাহিদাটি মুছে ফেলা হয়েছে।' });
});
