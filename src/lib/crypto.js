import { scrypt, randomBytes, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '../config/env.js';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const result = await derive(password, salt, 64, options);
  return `scrypt$32768$8$3$${salt}$${result.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (
    parts.length !== 6 ||
    parts.slice(0, 4).join('$') !== 'scrypt$32768$8$3' ||
    !/^[a-f0-9]{32}$/.test(parts[4]) ||
    !/^[a-f0-9]{128}$/.test(parts[5])
  )
    return false;
  const result = await derive(password, parts[4], 64, options);
  return timingSafeEqual(result, Buffer.from(parts[5], 'hex'));
}

export const tokenDigest = (token) => createHash('sha256').update(token).digest('hex');
export const otpDigest = (challenge, code) =>
  createHmac('sha256', env.auth.otpSecret).update(`${challenge}:${code}`).digest('hex');
export function sameDigest(left, right) {
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    left.length === right.length &&
    timingSafeEqual(Buffer.from(left), Buffer.from(right))
  );
}
