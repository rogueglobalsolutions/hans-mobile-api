CREATE TYPE "ContestWeekStatus" AS ENUM ('WINNER', 'TIE', 'NO_WINNER');

CREATE TABLE "ContestWeekResult" (
  "id" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "status" "ContestWeekStatus" NOT NULL,
  "winningVotes" INTEGER NOT NULL DEFAULT 0,
  "winnerEntryId" TEXT,
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContestWeekResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContestWeekResult_weekKey_key" ON "ContestWeekResult"("weekKey");
CREATE INDEX "ContestWeekResult_winnerEntryId_idx" ON "ContestWeekResult"("winnerEntryId");
CREATE INDEX "ContestWeekResult_resolvedById_idx" ON "ContestWeekResult"("resolvedById");

ALTER TABLE "ContestWeekResult"
  ADD CONSTRAINT "ContestWeekResult_winnerEntryId_fkey"
  FOREIGN KEY ("winnerEntryId") REFERENCES "ContestEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContestWeekResult"
  ADD CONSTRAINT "ContestWeekResult_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
