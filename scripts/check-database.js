import { sequelize } from '../src/config/database.js';

try {
  if (!sequelize) throw new Error('সংযোগের জন্য .env-এ DB_NAME ও DB_USER যোগ করুন।');
  await sequelize.authenticate();
  console.log('MySQL ডেটাবেসে Sequelize সংযোগ সফল।');
} catch (error) {
  console.error('ডেটাবেস সংযোগ ব্যর্থ।', sequelize ? 'MySQL চালু আছে কি না এবং .env-এর তথ্য যাচাই করুন।' : error.message);
  process.exitCode = 1;
} finally {
  await sequelize?.close();
}
