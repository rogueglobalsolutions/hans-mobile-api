import prisma from "../config/prisma";
import { Role } from "../generated/prisma/enums";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK_SIZE = 100;

export const PUSH_AUDIENCES = ["ALL", "MED", "USER", "SALES_REP"] as const;
export type PushAudience = (typeof PUSH_AUDIENCES)[number];

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

function isExpoToken(token: unknown): token is string {
  return typeof token === "string" && /^(Exponent|Expo)PushToken\[.+\]$/.test(token);
}

function audienceWhere(audience: PushAudience) {
  if (audience === "ALL") return { role: { in: [Role.MED, Role.USER, Role.SALES_REP] } };
  return { role: audience as Role };
}

// ─── Device tokens ────────────────────────────────────────────────────────────

export async function registerToken(userId: string, token: unknown, platform?: unknown) {
  if (!isExpoToken(token)) throw new Error("Invalid push token");
  const devicePlatform = typeof platform === "string" ? platform.slice(0, 20) : null;

  // A device belongs to whoever signed in on it last.
  await prisma.pushToken.upsert({
    where: { token },
    create: { token, userId, platform: devicePlatform },
    update: { userId, platform: devicePlatform },
  });
}

export async function unregisterToken(userId: string, token: unknown) {
  if (typeof token !== "string" || !token) return;
  await prisma.pushToken.deleteMany({ where: { token, userId } });
}

// ─── Delivery ─────────────────────────────────────────────────────────────────

/** Sends one message to every token and drops tokens Expo reports as gone. */
async function deliver(tokens: string[], message: PushMessage) {
  let sentCount = 0;
  let failedCount = 0;
  const staleTokens: string[] = [];
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  for (let i = 0; i < tokens.length; i += EXPO_CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + EXPO_CHUNK_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(
          chunk.map((to) => ({ to, title: message.title, body: message.body, data: message.data ?? {}, sound: "default" })),
        ),
      });
      const json: any = await response.json().catch(() => null);
      const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
      if (!response.ok || tickets.length !== chunk.length) {
        console.error("Expo push request failed:", response.status, JSON.stringify(json?.errors ?? json));
        failedCount += chunk.length;
        continue;
      }
      tickets.forEach((ticket, index) => {
        if (ticket?.status === "ok") {
          sentCount += 1;
          return;
        }
        failedCount += 1;
        if (ticket?.details?.error === "DeviceNotRegistered") staleTokens.push(chunk[index]);
      });
    } catch (error) {
      console.error("Expo push request error:", error);
      failedCount += chunk.length;
    }
  }

  if (staleTokens.length) {
    await prisma.pushToken.deleteMany({ where: { token: { in: staleTokens } } }).catch(() => undefined);
  }
  return { sentCount, failedCount };
}

/** Best-effort push to specific users; never throws. */
export async function sendToUsers(userIds: string[], message: PushMessage) {
  try {
    const ids = userIds.filter(Boolean);
    if (!ids.length) return;
    const tokens = await prisma.pushToken.findMany({ where: { userId: { in: ids } }, select: { token: true } });
    if (tokens.length) await deliver(tokens.map((t) => t.token), message);
  } catch (error) {
    console.error("Failed to send push notification:", error);
  }
}

// ─── Admin broadcast console ──────────────────────────────────────────────────

const broadcastSelect = {
  id: true,
  title: true,
  body: true,
  audience: true,
  recipientCount: true,
  sentCount: true,
  failedCount: true,
  createdAt: true,
  sentBy: { select: { fullName: true } },
} as const;

export async function getConsole() {
  const reachableEntries = await Promise.all(
    PUSH_AUDIENCES.map(async (audience) => {
      const count = await prisma.user.count({
        where: { ...audienceWhere(audience), pushTokens: { some: {} } },
      });
      return [audience, count] as const;
    }),
  );

  const broadcasts = await prisma.pushBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: broadcastSelect,
  });

  return { reachable: Object.fromEntries(reachableEntries), broadcasts };
}

export async function broadcast(adminId: string, input: { title?: unknown; body?: unknown; audience?: unknown }) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const audience = input.audience as PushAudience;

  if (!title) throw new Error("Notification title is required");
  if (!body) throw new Error("Notification message is required");
  if (title.length > 65) throw new Error("Notification title is too long");
  if (body.length > 240) throw new Error("Notification message is too long");
  if (!PUSH_AUDIENCES.includes(audience)) throw new Error("Invalid notification audience");

  const tokens = await prisma.pushToken.findMany({
    where: { user: audienceWhere(audience) },
    select: { token: true, userId: true },
  });
  const recipientCount = new Set(tokens.map((t) => t.userId)).size;
  if (!recipientCount) throw new Error("No devices to reach for this audience");

  const { sentCount, failedCount } = await deliver(
    tokens.map((t) => t.token),
    { title, body, data: { type: "broadcast" } },
  );

  return prisma.pushBroadcast.create({
    data: { title, body, audience, recipientCount, sentCount, failedCount, sentById: adminId },
    select: broadcastSelect,
  });
}
