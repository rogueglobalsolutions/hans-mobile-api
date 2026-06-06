import prisma from "../config/prisma";

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
  // Delete old slides and recreate — simplest approach
  await prisma.adSlide.deleteMany({ where: { adConfigId: id } });

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