import { sequelize } from '../src/config/database.js';
import { migrationRunner } from '../src/config/migrations.js';

try {
  if (!sequelize) throw new Error('ডেটাবেসের সংযোগ তথ্য যোগ করুন।');
  await sequelize.authenticate();
  const completed = await migrationRunner(sequelize).up();
  console.log(completed.length ? 'ডেটাবেসের টেবিল প্রস্তুত হয়েছে।' : 'সব মাইগ্রেশন আগেই সম্পন্ন হয়েছে।');
} catch (error) {
  console.error('মাইগ্রেশন সম্পন্ন করা যায়নি।', error.name, 'MySQL সংযোগ ও টেবিলের অবস্থা যাচাই করুন।');
  process.exitCode = 1;
} finally {
  await sequelize?.close();
}
