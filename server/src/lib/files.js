import mongoose from "mongoose";
import multer from "multer";
import { MAX_RECEIPT_BYTES, RECEIPT_TYPES } from "../../../shared/validate.js";

// Files live in MongoDB (GridFS), so the app runs on hosts without persistent disk.
let bucket;
const getBucket = () => (bucket ??= new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" }));

export function uploader(types = RECEIPT_TYPES) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 30 },
    fileFilter: (req, file, cb) => {
      if (types.includes(file.mimetype)) return cb(null, true);
      const err = new Error("Upload an image (JPG / PNG) or a PDF file.");
      err.status = 400;
      err.field = file.fieldname;
      cb(err);
    },
  });
}

export function saveFile(file, metadata = {}) {
  return new Promise((resolve, reject) => {
    const stream = getBucket().openUploadStream(file.originalname || "upload", {
      metadata: { ...metadata, contentType: file.mimetype },
    });
    stream.on("error", reject);
    stream.on("finish", () => resolve(stream.id));
    stream.end(file.buffer);
  });
}

export async function sendFile(id, res, filename) {
  if (!mongoose.isValidObjectId(id)) return res.status(404).end();
  const _id = new mongoose.Types.ObjectId(String(id));
  const [file] = await getBucket().find({ _id }).toArray();
  if (!file) return res.status(404).end();
  res.set({
    "Content-Type": file.metadata?.contentType || "application/octet-stream",
    "Content-Length": file.length,
    "Content-Disposition": `inline; filename="${(filename || file.filename).replace(/[^\w.\-]/g, "_")}"`,
    "Cache-Control": "private, max-age=300",
  });
  getBucket().openDownloadStream(_id).pipe(res);
}

export function deleteFile(id) {
  if (!id) return Promise.resolve();
  return getBucket().delete(new mongoose.Types.ObjectId(String(id))).catch(() => {});
}
