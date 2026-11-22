import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { sequelize, isDatabaseConfigured } from './config/database.js';
import { authRouter } from './routes/auth.js';
import { avatarDirectory } from './services/avatar.js';
import { AppError } from './lib/errors.js';
import { buyerRouter } from './routes/buyer.js';
import { adminRouter } from './routes/admin.js';
import { farmerRouter } from './routes/farmer.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || origin === env.clientOrigin) return callback(null, true);
      const error = new Error('এই ওয়েবসাইট থেকে সংযোগের অনুমতি নেই।');
      error.status = 403;
      callback(error);
    },
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(
  '/api/media/avatars',
  express.static(avatarDirectory, { dotfiles: 'deny', index: false, maxAge: '1d' }),
);
app.use('/api/auth', authRouter);
app.use('/api/buyer', buyerRouter);
app.use('/api/admin', adminRouter);
app.use('/api/farmer', farmerRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'ফিল্ডব্রিজ সার্ভার সচল আছে।',
    database: isDatabaseConfigured ? 'not_checked' : 'not_configured',
  });
});

app.get('/api/health/database', async (_req, res) => {
  if (!sequelize) {
    return res
      .status(503)
      .json({ success: false, message: 'ডেটাবেসের সংযোগ তথ্য এখনো যোগ করা হয়নি।' });
  }
  try {
    await sequelize.authenticate();
    res.json({ success: true, message: 'ডেটাবেস সংযোগ সফল।' });
  } catch {
    res.status(503).json({
      success: false,
      message: 'ডেটাবেসে সংযোগ করা যাচ্ছে না। সার্ভারের সংযোগ তথ্য যাচাই করুন।',
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'অনুরোধ করা ঠিকানাটি খুঁজে পাওয়া যায়নি।' });
});

app.use((error, _req, res, _next) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    });
  }
  if (error.name === 'SequelizeUniqueConstraintError') {
    const fields = {};
    for (const key of Object.keys(error.fields || {})) {
      if (key.includes('phone')) fields.phone = 'এই ফোন নম্বরে ইতিমধ্যে অ্যাকাউন্ট আছে।';
      if (key.includes('email')) fields.email = 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।';
      if (key.includes('nid')) fields.nid = 'এই NID দিয়ে ইতিমধ্যে কৃষক অ্যাকাউন্ট আছে।';
    }
    return res
      .status(409)
      .json({ success: false, message: 'এই তথ্য দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে।', fields });
  }
  if (error.name?.startsWith('Sequelize')) {
    return res.status(503).json({
      success: false,
      message: 'ডেটাবেস সেবায় সংযোগ করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
    });
  }
  if (error.name === 'MulterError') {
    return res.status(422).json({
      success: false,
      message: 'ছবিটি আপলোড করা যায়নি।',
      fields: { photo: 'একটি JPG, PNG অথবা WebP ছবি দিন (সর্বোচ্চ ২ মেগাবাইট)।' },
    });
  }
  const status = error.status || 500;
  res.status(status).json({
    success: false,
    message:
      status === 403
        ? error.message
        : status === 400
          ? 'অনুরোধের তথ্য সঠিক নয়।'
          : status === 413
            ? 'অনুরোধের তথ্যের আকার অনেক বড়।'
            : 'সার্ভারে একটি সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।',
  });
});
