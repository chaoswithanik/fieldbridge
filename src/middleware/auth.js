import cookieParser from 'cookie-parser';
import { env } from '../config/env.js';
import { sequelize } from '../config/database.js';
import { currentUser, SESSION_COOKIE } from '../services/auth.js';
import { AppError } from '../lib/errors.js';

export function requireRole(role) {
  return [
    cookieParser(),
    async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      if (
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
        req.get('origin') !== env.clientOrigin
      )
        throw new AppError(403, 'অনুমোদিত ওয়েবসাইট থেকে আবার চেষ্টা করুন।');
      if (!sequelize) throw new AppError(503, 'অ্যাকাউন্ট সেবা এখন প্রস্তুত নয়।');
      const user = await currentUser(req.cookies[SESSION_COOKIE]);
      if (!user) throw new AppError(401, 'এই পাতায় প্রবেশ করতে আগে লগইন করুন।');
      if (!(Array.isArray(role) ? role : [role]).includes(user.role))
        throw new AppError(403, 'এই কাজ করার অনুমতি আপনার নেই।');
      req.user = user;
      next();
    },
  ];
}
