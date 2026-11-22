import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';

dotenv.config({ quiet: true });

const testPrefix =
  process.env.NODE_ENV === 'test' && process.env.AUTH_INTEGRATION === '1'
    ? process.env.AUTH_TEST_TABLE_PREFIX
    : '';
if (testPrefix !== '' && !/^fb_test_[a-f0-9]{12}_$/.test(testPrefix || ''))
  throw new Error('পরীক্ষার জন্য বিচ্ছিন্ন টেবিলের নাম প্রয়োজন।');

function port(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${name}: ১ থেকে ৬৫৫৩৫-এর মধ্যে একটি পোর্ট দিন।`);
  }
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: port(process.env.PORT, 5001, 'PORT'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5174',
  auth: {
    otpMode:
      process.env.OTP_MODE || (process.env.NODE_ENV === 'production' ? 'disabled' : 'console'),
    otpSecret: process.env.OTP_SECRET || randomBytes(32).toString('hex'),
    otpExpiresSeconds: 300,
    otpResendSeconds: 60,
    otpMaxAttempts: 5,
    sessionDays: 7,
  },
  database: {
    tablePrefix: testPrefix,
    host: process.env.DB_HOST || '127.0.0.1',
    port: port(process.env.DB_PORT, 3306, 'DB_PORT'),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    logging: process.env.DB_LOGGING === 'true',
  },
};
