import prisma from "../config/prisma";
import { MediaSection } from "../generated/prisma/enums";
import fs from "fs";
import path from "path";

// ─── Before & After Entries (MED user) ────────────────────────────────────────

export async function createEntry(
  userId: string,
  title: string,
  description: string,
  mediaItems: { section: MediaSection; label: string; filePath: string }[],
) {
  return prisma.beforeAndAfterEntry.create({
    data: {
      userId,
      title,
      description,
      media: { create: mediaItems },
    },
    include: { media: true },
  });
}

export async function getMyEntries(userId: string) {
  return prisma.beforeAndAfterEntry.findMany({
    where: { userId },
    include: { media: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyEntryById(userId: string, entryId: string) {
  const entry = await prisma.beforeAndAfterEntry.findFirst({
    where: { id: entryId, userId },
    include: { media: true },
  });
  if (!entry) throw new Error("Entry not found");
  return entry;
}

export async function deleteEntry(userId: string, entryId: string) {
  const entry = await prisma.beforeAndAfterEntry.findFirst({
    where: { id: entryId, userId },
    include: { media: true },
  });
  if (!entry) throw new Error("Entry not found");

  // Delete media files from disk
  for (const media of entry.media) {
    const filePath = path.join(process.cwd(), media.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await prisma.beforeAndAfterEntry.delete({ where: { id: entryId } });
}

export async function getMyEntryCount(userId: string) {
  return prisma.beforeAndAfterEntry.count({ where: { userId } });
}

// ─── Contest Entries (MED user) ───────────────────────────────────────────────

const MINIMUM_BA_FOR_CONTEST = 5;

export async function createContestEntry(
  userId: string,
  title: string,
  description: string,
  mediaItems: { section: MediaSection; filePath: string; fileType: string }[],
) {
  const baCount = await getMyEntryCount(userId);
  if (baCount < MINIMUM_BA_FOR_CONTEST) {
    throw new Error(
      `You need at least ${MINIMUM_BA_FOR_CONTEST} Before & After entries before submitting to the contest. You currently have ${baCount}.`,
    );
  }

  return prisma.contestEntry.create({
    data: {
      userId,
      title,
      description,
      media: { create: mediaItems },
    },
    include: { media: true, _count: { select: { likes: true } } },
  });
}

export async function getMyContestEntries(userId: string) {
  return prisma.contestEntry.findMany({
    where: { userId },
    include: {
      media: true,
      _count: { select: { likes: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyContestEntryById(userId: string, entryId: string) {
  const entry = await prisma.contestEntry.findFirst({
    where: { id: entryId, userId },
    include: {
      media: true,
      _count: { select: { likes: true } },
      likes: { select: { adminId: true } },
    },
  });
  if (!entry) throw new Error("Contest entry not found");
  return entry;
}

export async function deleteContestEntry(userId: string, entryId: string) {
  const entry = await prisma.contestEntry.findFirst({
    where: { id: entryId, userId },
    include: { media: true },
  });
  if (!entry) throw new Error("Contest entry not found");

  for (const media of entry.media) {
    const filePath = path.join(process.cwd(), media.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  await prisma.contestEntry.delete({ where: { id: entryId } });
}

// ─── Admin: View B&A Entries ──────────────────────────────────────────────────

export async function getAllEntries() {
  return prisma.beforeAndAfterEntry.findMany({
    include: {
      media: true,
      user: { select: { id: true, fullName: true, email: true, profilePicturePath: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEntryByIdAdmin(entryId: string) {
  const entry = await prisma.beforeAndAfterEntry.findUnique({
    where: { id: entryId },
    include: {
      media: true,
      user: { select: { id: true, fullName: true, email: true, profilePicturePath: true } },
    },
  });
  if (!entry) throw new Error("Entry not found");
  return entry;
}

// ─── Admin: View & Like Contest Entries ───────────────────────────────────────

export async function getAllContestEntries(adminId: string) {
  const entries = await prisma.contestEntry.findMany({
    include: {
      media: true,
      user: { select: { id: true, fullName: true, email: true, profilePicturePath: true } },
      _count: { select: { likes: true } },
      likes: { where: { adminId }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return entries.map((e) => ({
    ...e,
    heartCount: e._count.likes,
    hearted: e.likes.length > 0,
    likes: undefined,
    _count: undefined,
  }));
}

export async function getContestEntryByIdAdmin(adminId: string, entryId: string) {
  const entry = await prisma.contestEntry.findUnique({
    where: { id: entryId },
    include: {
      media: true,
      user: { select: { id: true, fullName: true, email: true, profilePicturePath: true } },
      _count: { select: { likes: true } },
      likes: { where: { adminId }, select: { id: true } },
    },
  });
  if (!entry) throw new Error("Contest entry not found");

  return {
    ...entry,
    heartCount: entry._count.likes,
    hearted: entry.likes.length > 0,
    likes: undefined,
    _count: undefined,
  };
}

export async function toggleContestLike(adminId: string, entryId: string) {
  const entry = await prisma.contestEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Contest entry not found");

  const existing = await prisma.contestLike.findUnique({
    where: { entryId_adminId: { entryId, adminId } },
  });

  if (existing) {
    await prisma.contestLike.delete({ where: { id: existing.id } });
    return { liked: false };
  } else {
    await prisma.contestLike.create({ data: { entryId, adminId } });
    return { liked: true };
  }
}

// ─── Admin: Dashboard Stats ──────────────────────────────────────────────────

export async function getBAStats() {
  const [baCount, contestCount] = await Promise.all([
    prisma.beforeAndAfterEntry.count(),
    prisma.contestEntry.count(),
  ]);
  return { baCount, contestCount };
}
