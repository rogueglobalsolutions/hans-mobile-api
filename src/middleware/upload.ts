import multer from "multer";
import path from "path";
import fs from "fs";

// ─── Shared file filter ───────────────────────────────────────────────────────

const imageFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif", "application/octet-stream"];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, WebP, and HEIC images are allowed."));
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
    cb(null, `${userId}_profile_${Date.now()}${ext}`);
  },
});

export const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ─── Before & After media ─────────────────────────────────────────────────────

const baMediaDir = path.join(process.cwd(), "uploads", "ba-media");
if (!fs.existsSync(baMediaDir)) {
  fs.mkdirSync(baMediaDir, { recursive: true });
}

const baMediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, baMediaDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "unknown";
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${userId}_ba_${timestamp}_${Math.random().toString(36).slice(2, 6)}${ext}`);
  },
});

export const uploadBAMedia = multer({
  storage: baMediaStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── Contest media ────────────────────────────────────────────────────────────

const contestMediaDir = path.join(process.cwd(), "uploads", "contest-media");
if (!fs.existsSync(contestMediaDir)) {
  fs.mkdirSync(contestMediaDir, { recursive: true });
}

const contestMediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, contestMediaDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).userId || "unknown";
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${userId}_contest_${timestamp}_${Math.random().toString(36).slice(2, 6)}${ext}`);
  },
});

const contestFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif",
    "video/mp4", "video/quicktime", "video/x-msvideo",
    "application/octet-stream", // React Native sometimes sends this for picked media
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, WebP, HEIC images and MP4/MOV/AVI videos are allowed."));
  }
};

export const uploadContestMedia = multer({
  storage: contestMediaStorage,
  fileFilter: contestFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB for videos
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
