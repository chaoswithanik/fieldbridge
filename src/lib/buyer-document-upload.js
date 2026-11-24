import multer from 'multer';
import { AppError } from './errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 24, fieldSize: 8192, parts: 32 },
  fileFilter(_req, file, callback) {
    callback(
      ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        ? null
        : new AppError(422, 'নথির ফরম্যাট সঠিক নয়।', {
            documents: 'PDF, JPG, PNG অথবা WebP নথি দিন।',
          }),
      true,
    );
  },
}).array('documents', 5);

export function buyerDocumentsUpload(req, res, next) {
  upload(req, res, (error) => {
    if (error?.name === 'MulterError')
      return next(
        new AppError(422, 'নথি বা তথ্য আপলোড করা যায়নি।', {
          documents: 'সর্বোচ্চ ৫টি নথি দিন; প্রতিটি সর্বোচ্চ ৫ মেগাবাইট।',
        }),
      );
    next(error);
  });
}
