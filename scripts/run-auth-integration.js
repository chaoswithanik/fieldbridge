import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { sequelize } from '../src/config/database.js';

// Each suite owns disposable tables; no CREATE DATABASE grant or shared fixture state.
const suites = [
  'test/auth.integration.test.js',
  'test/requirements.integration.test.js',
  'test/collective.integration.test.js',
  'test/orders.integration.test.js',
  'test/replacements.integration.test.js',
];
try {
  if (!sequelize) throw new Error('configuration');
  for (const suite of suites) {
    const prefix = `fb_test_${randomBytes(6).toString('hex')}_`;
    try {
      const code = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--test', suite], {
          stdio: 'inherit',
          env: {
            ...process.env,
            AUTH_TEST_TABLE_PREFIX: prefix,
            AUTH_INTEGRATION: '1',
            NODE_ENV: 'test',
            OTP_MODE: 'console',
          },
        });
        child.on('error', reject);
        child.on('exit', (code) => resolve(code ?? 1));
      });
      if (code) process.exitCode = 1;
    } finally {
      for (const table of [
        'notifications',
        'order_items',
        'order_portions',
        'order_replacements',
        'orders',
        'auth_sessions',
        'purchase_requirements',
        'crop_listings',
        'buyer_documents',
        'buyer_profiles',
        'phone_verifications',
        'farmer_profiles',
        'users',
        'SequelizeMeta',
      ])
        await sequelize.query(`DROP TABLE IF EXISTS \`${prefix}${table}\``);
    }
  }
} catch (error) {
  console.error('বিচ্ছিন্ন MySQL পরীক্ষা চালানো যায়নি। ডেটাবেস সংযোগ যাচাই করুন।', error.name);
  process.exitCode = 1;
} finally {
  await sequelize?.close();
}
