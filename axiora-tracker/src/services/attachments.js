import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config.js';
import { badRequest, nowIso } from '../util.js';

// Extension allow-list; the MIME type stored is derived from it, never from the client.
const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf', txt: 'text/plain', log: 'text/plain', md: 'text/plain', csv: 'text/csv',
  json: 'application/json', zip: 'application/zip',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export const ALLOWED_EXTENSIONS = Object.keys(TYPES);
const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);

const extOf = (name) => path.extname(name).slice(1).toLowerCase();

export function createUpload() {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  const storage = multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}.${extOf(file.originalname)}`),
  });
  return multer({
    storage,
    limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: config.maxFilesPerUpload, fields: 50, fieldSize: 100 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (TYPES[extOf(file.originalname)]) return cb(null, true);
      cb(badRequest(`"${file.originalname}" is not an allowed file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`));
    },
  }).fields([{ name: 'files', maxCount: config.maxFilesPerUpload }, { name: 'files[]', maxCount: config.maxFilesPerUpload }]);
}

/** Multer middleware that turns its errors into friendly 400s. */
export function uploadMiddleware() {
  const upload = createUpload();
  return (req, res, next) => {
    upload(req, res, (err) => {
      // Accept both "files" and "files[]" (the browser sends the latter for PHP's sake).
      if (req.files && !Array.isArray(req.files)) req.files = [...(req.files.files || []), ...(req.files['files[]'] || [])];
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? `Each file must be ${config.maxUploadMb} MB or smaller.`
          : err.code === 'LIMIT_FILE_COUNT' ? `You can attach up to ${config.maxFilesPerUpload} files at a time.`
          : 'The upload could not be processed.';
        return next(badRequest(msg));
      }
      next(err);
    });
  };
}

/** Deletes uploaded temp files; used when the surrounding operation fails. */
export function discardFiles(files = []) {
  for (const f of files) fs.rm(f.path, { force: true }, () => {});
}

export function saveAttachments(db, files, { itemId = null, releaseId = null, context, refId = null, userId }) {
  const stmt = db.prepare(`INSERT INTO attachments
    (item_id, release_id, context, ref_id, original_name, stored_name, mime, size, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  return (files || []).map((f) => {
    const name = path.basename(f.originalname).slice(0, 200);
    const r = stmt.run(itemId, releaseId, context, refId, name, f.filename, TYPES[extOf(name)], f.size, userId, nowIso());
    return Number(r.lastInsertRowid);
  });
}

export function listAttachments(db, where, value) {
  return db.prepare(`SELECT a.id, a.item_id, a.release_id, a.context, a.ref_id, a.original_name, a.mime, a.size,
      a.created_at, u.name AS uploaded_by_name
    FROM attachments a JOIN users u ON u.id = a.uploaded_by WHERE a.${where} = ? ORDER BY a.id`).all(value);
}

export function sendAttachment(db, id, res) {
  const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
  if (!a) return false;
  const file = path.join(config.uploadDir, path.basename(a.stored_name));
  if (!fs.existsSync(file)) return false;
  const disposition = INLINE_TYPES.has(a.mime) ? 'inline' : 'attachment';
  res.setHeader('Content-Type', a.mime);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(a.original_name)}`);
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(file);
  return true;
}
