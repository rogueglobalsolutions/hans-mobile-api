import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { applicationSchemaQueries, checkDatabaseReadiness, schemaReadinessQueries } from "./readiness.service";

test("readiness covers every generated model and the previously missing fields", () => {
  assert.equal(applicationSchemaQueries.length, 33);
  assert.ok(applicationSchemaQueries.some((query) => query.includes('"deletedAt"') && query.includes('"public"."User"')));
  assert.ok(applicationSchemaQueries.some((query) => query.includes('"weightLbs"') && query.includes('"public"."Product"')));
  assert.ok(applicationSchemaQueries.some((query) => query.includes('"public"."TrainingChangeRequest"')));
  assert.ok(applicationSchemaQueries.some((query) => query.includes('"public"."ContestWeekResult"')));
  for (const query of applicationSchemaQueries) assert.match(query, /^SELECT .* LIMIT 0$/);
  const schema = fs.readFileSync(path.join(__dirname, "..", "..", "prisma", "schema.prisma"), "utf8");
  assert.doesNotMatch(schema, /@@?map\s*\(|@@schema\s*\(/, "Adapt readiness metadata before adding database name/schema mappings.");
});

test("readiness quotes identifiers and refuses empty schema checks", () => {
  assert.deepEqual(schemaReadinessQueries([{ table: 'A"B', columns: ['C"D'] }]), [
    'SELECT "C""D" FROM "public"."A""B" LIMIT 0',
  ]);
  assert.throws(() => schemaReadinessQueries([]), /nonempty/);
  assert.throws(() => schemaReadinessQueries([{ table: "User", columns: [] }]), /nonempty/);
});

test("database readiness uses a bounded read-only transaction and retrieves zero rows", async () => {
  const queries: string[] = [];
  let options: unknown;
  const database = {
    async $transaction<T>(callback: (tx: {
      $executeRawUnsafe: (query: string) => Promise<number>;
      $queryRawUnsafe: (query: string) => Promise<unknown[]>;
    }) => Promise<T>, settings: unknown): Promise<T> {
      options = settings;
      return callback({
        $executeRawUnsafe: async (query) => { queries.push(query); return 0; },
        $queryRawUnsafe: async (query) => { queries.push(query); return []; },
      });
    },
  };
  await checkDatabaseReadiness(database);
  assert.deepEqual(options, { maxWait: 2000, timeout: 8000 });
  assert.equal(queries[0], "SET TRANSACTION READ ONLY");
  assert.deepEqual(queries.slice(1), applicationSchemaQueries);
});

test("a missing table or column prevents database readiness", async () => {
  const database = {
    async $transaction<T>(callback: (tx: {
      $executeRawUnsafe: () => Promise<number>;
      $queryRawUnsafe: () => Promise<never>;
    }) => Promise<T>): Promise<T> {
      return callback({ $executeRawUnsafe: async () => 0,
        $queryRawUnsafe: async () => { throw new Error("missing column"); } });
    },
  };
  await assert.rejects(checkDatabaseReadiness(database), /missing column/);
});
