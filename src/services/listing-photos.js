import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AppError } from '../lib/errors.js';
import { photoFilenamePattern } from '../lib/listing-validation.js';

export const listingPhotoDirectory = fileURLToPath(
  new URL('../../uploads/crops/', import.meta.url),
);

export async function saveListingPhotos(files) {
  const saved = [];
  try {
    await mkdir(listingPhotoDirectory, { recursive: true });
    for (const file of files) {
      let buffer;
      try {
        const image = sharp(file.buffer, { limitInputPixels: 16000000, animated: false });
        const meta = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages || 1) > 1)
          throw new Error('format');
        buffer = await image
          .rotate()
          .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
      } catch {
        throw new AppError(422, 'ছবিটি পড়া যাচ্ছে না।', {
          photos: 'সঠিক JPG, PNG অথবা WebP ছবি দিন (প্রতিটি সর্বোচ্চ ২ মেগাবাইট)।',
        });
      }
      const filename = `${randomUUID()}.webp`;
      await writeFile(join(listingPhotoDirectory, filename), buffer, { flag: 'wx', mode: 0o600 });
      saved.push(filename);
    }
    return saved;
  } catch (error) {
    await deleteListingPhotos(saved);
    throw error;
  }
}

export async function deleteListingPhotos(filenames) {
  await Promise.all(
    filenames
      .filter((name) => photoFilenamePattern.test(name))
      .map(async (name) => {
        try {
          await unlink(join(listingPhotoDirectory, name));
        } catch (error) {
          if (error.code !== 'ENOENT') console.error('ফসলের একটি পুরোনো ছবি মুছে ফেলা যায়নি।');
        }
      }),
  );
}
