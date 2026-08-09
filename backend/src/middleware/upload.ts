import multer from 'multer';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ALLOWED_MIME } from '../services/storage/index.js';
import { AppError } from '../lib/AppError.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new AppError('VALIDATION_ERROR', 'Unsupported file type'));
      return;
    }
    cb(null, true);
  },
});

/** Single-file upload under field name "file", validated by MIME and size. */
export const singleUpload: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('VALIDATION_ERROR', 'File exceeds the 10MB limit'));
      }
      return next(new AppError('VALIDATION_ERROR', err.message));
    }
    next(err);
  });
};
