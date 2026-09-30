import assert from "node:assert/strict";
import test from "node:test";
import { issueTrainingCredits } from "./credit.service";

function creditTx() {
  const transactions: Array<{ type: string; amount: number }> = [];
  const balanceUpdates: unknown[] = [];
  let grantData: Record<string, unknown> | null = null;

  return {
    transactions,
    balanceUpdates,
    get grantData() { return grantData; },
    creditGrant: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        grantData = data;
        return { id: "grant-1", ...data };
      },
    },
    creditTransaction: {
      create: async ({ data }: { data: { type: string; amount: number } }) => {
        transactions.push(data);
      },
    },
    user: {
      update: async (data: unknown) => {
        balanceUpdates.push(data);
      },
    },
  };
}

test("credits completed within the redemption window remain spendable", async () => {
  const tx = creditTx();
  await issueTrainingCredits(tx, {
    userId: "user-1",
    enrollmentId: "enrollment-1",
    trainingTitle: "MINT Lift",
    amount: 1500,
    finalTrainingDate: new Date("2100-01-01T00:00:00Z"),
  });

  assert.equal(tx.grantData?.remainingAmount, 1500);
  assert.equal(tx.grantData?.expiredAt, null);
  assert.deepEqual(tx.transactions.map(({ type }) => type), ["EARNED"]);
  assert.equal(tx.balanceUpdates.length, 1);
});

test("credits completed after expiry are recorded but never added to the balance", async () => {
  const tx = creditTx();
  await issueTrainingCredits(tx, {
    userId: "user-1",
    enrollmentId: "enrollment-1",
    trainingTitle: "MINT Lift",
    amount: 1500,
    finalTrainingDate: new Date("2020-01-01T00:00:00Z"),
  });

  assert.equal(tx.grantData?.remainingAmount, 0);
  assert.ok(tx.grantData?.expiredAt instanceof Date);
  assert.deepEqual(tx.transactions.map(({ type }) => type), ["EARNED", "EXPIRED"]);
  assert.equal(tx.balanceUpdates.length, 0);
});
