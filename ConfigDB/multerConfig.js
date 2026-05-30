import fs from "fs";
import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const uploadDir = path.join(process.cwd(), "Public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let storage;

if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "adaptive-learning",
      allowed_formats: ["jpg", "jpeg", "png", "pdf", "mp4", "webm", "ogg"],
      resource_type: "auto",
    },
  });
} else {
  console.warn(
    "[multerConfig] Cloudinary credentials are missing. Falling back to local upload storage."
  );

  storage = multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadDir);
    },
    filename(req, file, cb) {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "-");
      cb(null, `${timestamp}-${safeName}`);
    },
  });
}

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/pdf",
    "video/mp4",
    "video/webm",
    "video/ogg"
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }
});