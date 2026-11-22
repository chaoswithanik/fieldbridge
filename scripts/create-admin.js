import { sequelize } from '../src/config/database.js';
import { createAdminAccount } from '../src/services/admin.js';
import { AppError } from '../src/lib/errors.js';

try {
  if (!sequelize) throw new AppError(503, 'মূল .env-এ MySQL সংযোগের তথ্য দিন।');
  if (!process.env.ADMIN_PHONE || !process.env.ADMIN_PASSWORD)
    throw new AppError(422, 'মূল .env-এ ADMIN_PHONE ও ADMIN_PASSWORD যোগ করুন।');
  await sequelize.authenticate();
  const result = await createAdminAccount({
    fullName: process.env.ADMIN_NAME || 'ফিল্ডব্রিজ অ্যাডমিন',
    phone: process.env.ADMIN_PHONE,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  console.log(
    result.created
      ? 'অ্যাডমিন অ্যাকাউন্ট তৈরি হয়েছে। /login থেকে প্রবেশ করুন।'
      : 'এই অ্যাডমিন আগে থেকেই আছেন। তাঁর তথ্য বা পাসওয়ার্ড পরিবর্তন করা হয়নি।',
  );
} catch (error) {
  console.error(
    error instanceof AppError
      ? error.message
      : 'অ্যাডমিন তৈরি করা যায়নি। MySQL সংযোগ ও npm run db:migrate যাচাই করুন।',
  );
  process.exitCode = 1;
} finally {
  await sequelize?.close();
}
