import { Router } from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { env } from '../config/env.js';
import { sequelize } from '../config/database.js';
import { AppError } from '../lib/errors.js';
import {
  requestFarmerOtp,
  registerFarmer,
  login,
  currentUser,
  revokeSession,
  SESSION_COOKIE,
  cookieOptions,
} from '../services/auth.js';
import { createBuyer } from '../services/buyers.js';
import { buyerDocumentsUpload } from '../lib/buyer-document-upload.js';

export const authRouter = Router();
authRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
authRouter.use(cookieParser());
authRouter.use((req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== env.clientOrigin) {
    return next(new AppError(403, 'অনুমোদিত ওয়েবসাইট থেকে আবার চেষ্টা করুন।'));
  }
  if (!sequelize) return next(new AppError(503, 'অ্যাকাউন্ট সেবা এখন প্রস্তুত নয়। পরে আবার চেষ্টা করুন।'));
  next();
});

function limiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        message: 'অল্প সময়ে অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
      }),
  });
}

const photo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 16, fieldSize: 4096 },
  fileFilter(_req, file, callback) {
    callback(
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        ? null
        : new AppError(422, 'JPG, PNG অথবা WebP ছবি দিন।', { photo: 'ছবির ফরম্যাট সঠিক নয়।' }),
      true,
    );
  },
}).single('photo');

function setSession(res, result) {
  res.cookie(SESSION_COOKIE, result.token, { ...cookieOptions, expires: result.expiresAt });
}

authRouter.post('/farmers/otp', limiter(10), async (req, res) => {
  const verification = await requestFarmerOtp(req.body);
  res.status(201).json({
    success: true,
    message: 'ফোন যাচাই করার কোড প্রস্তুত।',
    delivery: 'console',
    ...verification,
  });
});

authRouter.post('/farmers/register', limiter(25), photo, async (req, res) => {
  const result = await registerFarmer(req.body || {}, req.file);
  setSession(res, result);
  res
    .status(201)
    .json({ success: true, message: 'আপনার কৃষক অ্যাকাউন্ট তৈরি হয়েছে।', user: result.user });
});

authRouter.post('/login', limiter(20), async (req, res) => {
  const result = await login(req.body);
  const previous = req.cookies[SESSION_COOKIE];
  if (previous) await revokeSession(previous);
  setSession(res, result);
  res.json({ success: true, message: 'সফলভাবে প্রবেশ করেছেন।', user: result.user });
});

authRouter.get('/me', async (req, res) => {
  if (!req.cookies[SESSION_COOKIE]) return res.json({ success: true, user: null });
  const user = await currentUser(req.cookies[SESSION_COOKIE]);
  if (!user) res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.json({ success: true, user });
});

authRouter.post('/buyers/register', limiter(10), buyerDocumentsUpload, async (req, res) => {
  const result = await createBuyer(req.body || {}, req.files);
  if (req.cookies[SESSION_COOKIE]) await revokeSession(req.cookies[SESSION_COOKIE]);
  setSession(res, result);
  res
    .status(201)
    .json({
      success: true,
      message: 'আপনার আবেদন জমা হয়েছে। অ্যাডমিনের অনুমোদনের জন্য অপেক্ষা করুন।',
      user: result.user,
    });
});

authRouter.post('/logout', async (req, res) => {
  await revokeSession(req.cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.json({ success: true, message: 'সফলভাবে বের হয়েছেন।' });
});
