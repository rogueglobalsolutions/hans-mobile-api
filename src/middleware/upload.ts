import multer from "multer";
import path from "path";
import fs from "fs";

// ─── Shared file filter ───────────────────────────────────────────────────────

const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, and WebP images are allowed."));
  }
};

// ─── Verification ID documents ───────────────────────────────────────────────

const verificationsDir = path.join(process.cwd(), "uploads", "verifications");
if (!fs.existsSync(verificationsDir)) {
  fs.mkdirSync(verificationsDir, { recursive: true });
}

const verificationStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, verificationsDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "unknown";
    const timestamp = Date.now();
    const side = file.fieldname; // 'idDocumentFront' or 'idDocumentBack'
    const ext = path.extname(file.originalname);
    cb(null, `${userId}_${timestamp}_${side}${ext}`);
  },
});

export const upload = multer({
  storage: verificationStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Training background images ──────────────────────────────────────────────

const trainingsBgDir = path.join(process.cwd(), "uploads", "trainings-bg-img");
if (!fs.existsSync(trainingsBgDir)) {
  fs.mkdirSync(trainingsBgDir, { recursive: true });
}

const trainingBgStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, trainingsBgDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `training_${timestamp}${ext}`);
  },
});

export const uploadTrainingBg = multer({
  storage: trainingBgStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB — backgrounds can be larger
});

// ─── Profile pictures ─────────────────────────────────────────────────────────

const profilePicturesDir = path.join(process.cwd(), "uploads", "profile-pictures");
if (!fs.existsSync(profilePicturesDir)) {
  fs.mkdirSync(profilePicturesDir, { recursive: true });
}

const profilePictureStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, profilePicturesDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "unknown";
    const ext = path.extname(file.originalname);
    cb(null, `${userId}_profile${ext}`);
  },
});

export const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Chat images ──────────────────────────────────────────────────────────────

const chatImagesDir = path.join(process.cwd(), "uploads", "chat");
if (!fs.existsSync(chatImagesDir)) {
  fs.mkdirSync(chatImagesDir, { recursive: true });
}

const chatImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, chatImagesDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "unknown";
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${userId}_${timestamp}${ext}`);
  },
});

export const uploadChatImage = multer({
  storage: chatImageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
