import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AppError } from '../lib/errors.js';

export const buyerDocumentDirectory = fileURLToPath(
  new URL('../../uploads/buyer-documents/', import.meta.url),
);
export const buyerDocumentTypes = [
  'trade_license',
  'incorporation_certificate',
  'partnership_deed',
  'cooperative_certificate',
  'etin_certificate',
  'vat_bin_certificate',
  'import_registration_certificate',
];
export const buyerDocumentFilenamePattern = /^[a-f0-9-]{36}\.(?:pdf|webp)$/;

const documentError = (message) =>
  new AppError(422, message, {
    documents: 'সর্বোচ্চ ৫টি PDF, JPG, PNG বা WebP নথি দিন; প্রতিটি সর্বোচ্চ ৫ মেগাবাইট।',
  });

export async function prepareBuyerDocuments(files, rawTypes, { required = false } = {}) {
  const uploads = Array.isArray(files) ? files : [];
  if (!uploads.length) {
    if (required) throw documentError('অন্তত একটি ব্যবসায়িক নথি আপলোড করুন।');
    return [];
  }
  const types = Array.isArray(rawTypes) ? rawTypes : [rawTypes];
  if (
    uploads.length > 5 ||
    types.length !== uploads.length ||
    types.some((type) => typeof type !== 'string' || !buyerDocumentTypes.includes(type))
  )
    throw documentError('প্রতিটি নথির ধরন বেছে দিন।');

  const prepared = [];
  for (const [index, file] of uploads.entries()) {
    if (!file?.buffer?.length) throw documentError('একটি নথি পড়া যাচ্ছে না।');
    if (file.mimetype === 'application/pdf') {
      if (!file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-')))
        throw documentError('PDF নথিটি সঠিক নয়।');
      prepared.push({ documentType: types[index], contentType: 'application/pdf', buffer: file.buffer });
      continue;
    }
    try {
      const image = sharp(file.buffer, { limitInputPixels: 24000000, animated: false });
      const metadata = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1)
        throw new Error('format');
      prepared.push({
        documentType: types[index],
        contentType: 'image/webp',
        buffer: await image
          .rotate()
          .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer(),
      });
    } catch {
      throw documentError('ছবির নথিটি পড়া যাচ্ছে না।');
    }
  }
  return prepared;
}

export async function saveBuyerDocuments(documents) {
  const filenames = [];
  try {
    await mkdir(buyerDocumentDirectory, { recursive: true });
    for (const document of documents) {
      const filename = `${randomUUID()}.${document.contentType === 'application/pdf' ? 'pdf' : 'webp'}`;
      await writeFile(join(buyerDocumentDirectory, filename), document.buffer, {
        flag: 'wx',
        mode: 0o600,
      });
      filenames.push(filename);
    }
    return documents.map((document, index) => ({
      documentType: document.documentType,
      contentType: document.contentType,
      filename: filenames[index],
    }));
  } catch (error) {
    await deleteBuyerDocuments(filenames);
    throw error;
  }
}

export async function deleteBuyerDocuments(filenames) {
  await Promise.all(
    filenames
      .filter((filename) => buyerDocumentFilenamePattern.test(filename))
      .map(async (filename) => {
        try {
          await unlink(join(buyerDocumentDirectory, filename));
        } catch (error) {
          if (error.code !== 'ENOENT') console.error('ক্রেতার একটি নথি মুছে ফেলা যায়নি।');
        }
      }),
  );
}
