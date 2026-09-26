import prisma from "../config/prisma";
import { ContestWeekStatus } from "../generated/prisma/enums";

const EASTERN_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type VoteRow = { id: string; createdAt: Date; _count: { likes: number } };

export function contestWeekKey(date: Date) {
  const parts = Object.fromEntries(EASTERN_DATE.formatToParts(date).map((part) => [part.type, part.value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

function weekBucket(weekKey: string, currentWeekKey: string) {
  const weeksAgo = Math.round((Date.parse(currentWeekKey) - Date.parse(weekKey)) / (7 * 86400000));
  if (weeksAgo <= 0) return "this_week";
  if (weeksAgo === 1) return "last_week";
  if (weeksAgo === 2) return "2_weeks_ago";
  return "older";
}

export async function finalizeClosedContestWeeks(now = new Date()) {
  const rows = await prisma.contestEntry.findMany({
    select: { id: true, createdAt: true, _count: { select: { likes: true } } },
  });
  const currentWeekKey = contestWeekKey(now);
  const groups = new Map<string, VoteRow[]>();
  for (const row of rows) {
    const key = contestWeekKey(row.createdAt);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const closedKeys = [...groups.keys()].filter((key) => key < currentWeekKey);
  const existing = await prisma.contestWeekResult.findMany({
    where: { weekKey: { in: closedKeys } }, select: { weekKey: true },
  });
  const finalized = new Set(existing.map((result) => result.weekKey));

  for (const [weekKey, entries] of groups) {
    if (weekKey >= currentWeekKey || finalized.has(weekKey)) continue;
    const winningVotes = Math.max(...entries.map((entry) => entry._count.likes));
    const leaders = entries.filter((entry) => entry._count.likes === winningVotes);
    const status = winningVotes === 0
      ? ContestWeekStatus.NO_WINNER
      : leaders.length === 1 ? ContestWeekStatus.WINNER : ContestWeekStatus.TIE;
    await prisma.contestWeekResult.upsert({
      where: { weekKey },
      create: {
        weekKey,
        status,
        winningVotes,
        winnerEntryId: status === ContestWeekStatus.WINNER ? leaders[0].id : null,
      },
      update: {},
    });
  }

  return { rows, groups, currentWeekKey };
}

export async function getContestEntryStatuses(now = new Date()) {
  const { rows, groups, currentWeekKey } = await finalizeClosedContestWeeks(now);
  const results = await prisma.contestWeekResult.findMany({
    where: { weekKey: { in: [...groups.keys()].filter((key) => key < currentWeekKey) } },
  });
  const byWeek = new Map(results.map((result) => [result.weekKey, result]));
  const statuses = new Map<string, {
    weekKey: string;
    weekBucket: string;
    weekStatus: string;
    isWinner: boolean;
    isTiedLeader: boolean;
    canLike: boolean;
  }>();

  for (const row of rows) {
    const weekKey = contestWeekKey(row.createdAt);
    const result = byWeek.get(weekKey);
    statuses.set(row.id, {
      weekKey,
      weekBucket: weekBucket(weekKey, currentWeekKey),
      weekStatus: result?.status === ContestWeekStatus.WINNER && !result.winnerEntryId
        ? ContestWeekStatus.NO_WINNER : result?.status ?? "OPEN",
      isWinner: result?.status === ContestWeekStatus.WINNER && result.winnerEntryId === row.id,
      isTiedLeader: result?.status === ContestWeekStatus.TIE && row._count.likes === result.winningVotes,
      canLike: weekKey === currentWeekKey,
    });
  }
  return statuses;
}

export async function resolveContestTie(adminId: string, weekKey: string, entryId: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey) || contestWeekKey(new Date(`${weekKey}T12:00:00Z`)) !== weekKey) {
    throw new Error("Invalid contest week");
  }
  const { groups, currentWeekKey } = await finalizeClosedContestWeeks();
  if (weekKey >= currentWeekKey) throw new Error("This contest week is still open");
  const result = await prisma.contestWeekResult.findUnique({ where: { weekKey } });
  if (!result || result.status !== ContestWeekStatus.TIE) throw new Error("This week has no unresolved tie");
  const leaders = (groups.get(weekKey) ?? []).filter((entry) => entry._count.likes === result.winningVotes);
  if (leaders.length < 2 || !leaders.some((entry) => entry.id === entryId)) {
    throw new Error("Choose one of the tied top-voted entries");
  }
  const updated = await prisma.contestWeekResult.updateMany({
    where: { weekKey, status: ContestWeekStatus.TIE },
    data: { status: ContestWeekStatus.WINNER, winnerEntryId: entryId, resolvedById: adminId },
  });
  if (updated.count !== 1) throw new Error("This tie was already resolved");
  return prisma.contestWeekResult.findUnique({ where: { weekKey } });
}
