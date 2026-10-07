import { Prisma } from "../generated/prisma/client";
import prisma from "../config/prisma";

export interface SchemaSelection {
  table: string;
  columns: string[];
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function schemaReadinessQueries(selections: SchemaSelection[]): string[] {
  if (!selections.length || selections.some((selection) => !selection.columns.length)) {
    throw new Error("Readiness requires nonempty schema selections.");
  }
  return selections.map(({ table, columns }) =>
    `SELECT ${columns.map(quoteIdentifier).join(", ")} FROM "public".${quoteIdentifier(table)} LIMIT 0`);
}

// This schema uses unmapped public model/column names; a contract test guards that assumption.
const metadata = Prisma as unknown as Record<string, Record<string, string>>;
export const applicationSchemaQueries = schemaReadinessQueries(Object.values(Prisma.ModelName).map((table) => ({
  table, columns: Object.values(metadata[`${table}ScalarFieldEnum`]!),
})));

interface ReadinessTransaction {
  $executeRawUnsafe(query: string): Promise<unknown>;
  $queryRawUnsafe(query: string): Promise<unknown>;
}

interface ReadinessDatabase {
  $transaction<T>(callback: (tx: ReadinessTransaction) => Promise<T>, options: { maxWait: number; timeout: number }): Promise<T>;
}

export async function checkDatabaseReadiness(
  database: ReadinessDatabase = prisma,
  queries: string[] = applicationSchemaQueries,
): Promise<void> {
  await database.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    // LIMIT 0 verifies every expected table/column without fetching any customer data.
    for (const query of queries) await tx.$queryRawUnsafe(query);
  }, { maxWait: 2_000, timeout: 8_000 });
}
