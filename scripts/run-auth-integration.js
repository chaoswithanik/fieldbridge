import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { sequelize } from '../src/config/database.js';

// Own disposable, uniquely prefixed tables. No CREATE DATABASE grant is needed.
const prefix = `fb_test_${randomBytes(6).toString('hex')}_`;
try {
  if (!sequelize) throw new Error('configuration');
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', 'test/auth.integration.test.js'], {
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
} catch (error) {
  console.error('বিচ্ছিন্ন MySQL পরীক্ষা চালানো যায়নি। ডেটাবেস সংযোগ যাচাই করুন।', error.name);
  process.exitCode = 1;
} finally {
  if (sequelize) {
    for (const table of [
      'auth_sessions',
      'crop_listings',
      'buyer_profiles',
      'phone_verifications',
      'farmer_profiles',
      'users',
      'SequelizeMeta',
    ]) {
      await sequelize.query(`DROP TABLE IF EXISTS \`${prefix}${table}\``);
    }
  }
  await sequelize?.close();
}
