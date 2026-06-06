import prisma from "../config/prisma";
import fs from "fs";
import path from "path";

type AdSlide = {
  id?: string;
  imageUrl: string;
  redirectUrl: string;
};

type AdConfigInput = {
  slides: AdSlide[];
  isActive: boolean;
  intervalSeconds: number;
};

// ─── Helper: delete image file from disk ─────────────────────────────────────

function deleteImageFile(imageUrl: string) {
  try {
    const filePath = path.join(process.cwd(), imageUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error("Failed to delete ad image file:", e);
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createAdConfig(input: AdConfigInput) {
  const config = await prisma.adConfig.create({
    data: {
      isActive: input.isActive ?? true,
      intervalSeconds: input.intervalSeconds ?? 3,
      slides: {
        create: input.slides.map((slide) => ({
          imageUrl: slide.imageUrl,
          redirectUrl: slide.redirectUrl ?? "",
        })),
      },
    },
    include: { slides: true },
  });
  return config;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateAdConfig(id: string, input: AdConfigInput) {
  // Get old slides first so we can delete their image files
  const oldSlides = await prisma.adSlide.findMany({ where: { adConfigId: id } });

  // Find which old images are no longer in the new slides
  const newImageUrls = new Set(input.slides.map((s) => s.imageUrl));
  const removedSlides = oldSlides.filter((s) => !newImageUrls.has(s.imageUrl));

  // Delete old slides from DB
  await prisma.adSlide.deleteMany({ where: { adConfigId: id } });

  // Delete removed image files from disk
  removedSlides.forEach((s) => deleteImageFile(s.imageUrl));

  const config = await prisma.adConfig.update({
    where: { id },
    data: {
      isActive: input.isActive,
      intervalSeconds: input.intervalSeconds ?? 3,
      slides: {
        create: input.slides.map((slide) => ({
          imageUrl: slide.imageUrl,
          redirectUrl: slide.redirectUrl ?? "",
        })),
      },
    },
    include: { slides: true },
  });
  return config;
}

// ─── Get (latest config) ──────────────────────────────────────────────────────

export async function getAdConfig() {
  const config = await prisma.adConfig.findFirst({
    orderBy: { createdAt: "desc" },
    include: { slides: true },
  });
  return config;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteAdConfig(id: string) {
  // Get slides first so we can delete their image files
  const slides = await prisma.adSlide.findMany({ where: { adConfigId: id } });

  // Delete slides from DB
  await prisma.adSlide.deleteMany({ where: { adConfigId: id } });
  await prisma.adConfig.delete({ where: { id } });

  // Delete image files from disk
  slides.forEach((s) => deleteImageFile(s.imageUrl));
}