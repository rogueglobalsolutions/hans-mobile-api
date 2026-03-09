import prisma from "../config/prisma";

const MESSAGE_SELECT = {
  id: true,
  message: true,
  imageUrl: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      profilePicturePath: true,
    },
  },
} as const;

export async function saveMessage(userId: string, message?: string, imageUrl?: string) {
  return prisma.chatMessage.create({
    data: { userId, message, imageUrl },
    select: MESSAGE_SELECT,
  });
}

export async function getRecentMessages(limit = 50) {
  const messages = await prisma.chatMessage.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: MESSAGE_SELECT,
  });

  // Return in chronological order (oldest first)
  return messages.reverse();
}
