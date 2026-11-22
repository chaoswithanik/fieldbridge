import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AppError } from '../lib/errors.js';

export const avatarDirectory = fileURLToPath(new URL('../../uploads/avatars/', import.meta.url));

export async function prepareAvatar(file) {
  if (!file) return null;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 16000000, animated: false });
    const meta = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error('format');
    return await image
      .rotate()
      .resize(320, 320, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new AppError(422, 'ছবিটি পড়া যাচ্ছে না।', {
      photo: 'সঠিক JPG, PNG অথবা WebP ছবি দিন (সর্বোচ্চ ২ মেগাবাইট)।',
    });
  }
}

export async function saveAvatar(buffer) {
  if (!buffer) return null;
  const filename = `${randomUUID()}.webp`;
  await mkdir(avatarDirectory, { recursive: true });
  await writeFile(join(avatarDirectory, filename), buffer, { flag: 'wx', mode: 0o600 });
  return filename;
}

export async function deleteAvatar(filename) {
  if (filename && /^[a-f0-9-]{36}\.webp$/.test(filename))
    await unlink(join(avatarDirectory, filename)).catch(() => {});
}
